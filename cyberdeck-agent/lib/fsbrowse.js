"use strict";
/*
 * fsbrowse.js — navegação READ-ONLY do rootfs com proteções.
 *
 * Segurança:
 *   - path sempre normalizado e absoluto (path.resolve a partir de "/");
 *   - rejeita NUL e qualquer coisa que não comece em "/";
 *   - usa lstat (não segue symlink automaticamente) — reporta o alvo;
 *   - limita nº de entradas por diretório e tamanho de arquivo lido;
 *   - detecta binário e recusa renderizar como texto;
 *   - NÃO escreve, NÃO deleta, NÃO executa. Apenas leitura.
 */
const fs = require("fs");
const path = require("path");

const MAX_ENTRIES = 600;      // entradas devolvidas por diretório
const MAX_READ_BYTES = 256 * 1024; // 256 KiB por arquivo

/** Erros estruturados (code mapeado pelo http.js). */
function err(code, message) { const e = new Error(message); e.code = code; return e; }

/**
 * Normaliza um path solicitado pela UI para um absoluto seguro.
 * Tudo é resolvido a partir de "/", então "../.." nunca sobe acima da raiz.
 */
function safePath(p) {
  p = String(p == null ? "/" : p);
  if (p.indexOf("\0") !== -1) throw err("BAD_REQUEST", "path inválido");
  if (p === "") p = "/";
  // resolve a partir da raiz: '/a/../../etc' -> '/etc'; nunca escapa de '/'
  const abs = path.resolve("/", p);
  return abs;
}

function typeOf(st) {
  if (st.isSymbolicLink()) return "symlink";
  if (st.isDirectory()) return "dir";
  if (st.isFile()) return "file";
  if (st.isBlockDevice()) return "block";
  if (st.isCharacterDevice()) return "char";
  if (st.isFIFO()) return "fifo";
  if (st.isSocket()) return "socket";
  return "other";
}

/** Permissões estilo rwx a partir do mode. */
function permString(mode) {
  const r = (m) => (m & 4 ? "r" : "-") + (m & 2 ? "w" : "-") + (m & 1 ? "x" : "-");
  return r((mode >> 6) & 7) + r((mode >> 3) & 7) + r(mode & 7);
}

function entryInfo(dir, name) {
  const full = path.join(dir, name);
  let st;
  try { st = fs.lstatSync(full); }
  catch (e) { return { name, type: "other", error: e.code || "ERR" }; }
  const info = {
    name,
    type: typeOf(st),
    size: Number(st.size),
    mode: permString(st.mode),
    uid: st.uid,
    gid: st.gid,
    mtime: st.mtimeMs ? Math.round(st.mtimeMs) : 0,
  };
  if (st.isSymbolicLink()) {
    try { info.target = fs.readlinkSync(full); } catch (e) { info.target = "?"; }
  }
  return info;
}

/** Lista um diretório. Retorna { path, parent, truncated, entries[] }. */
function list(reqPath) {
  const dir = safePath(reqPath);
  let st;
  try { st = fs.lstatSync(dir); }
  catch (e) {
    if (e.code === "EACCES") throw err("PERMISSION_DENIED", "sem permissão: " + dir);
    if (e.code === "ENOENT") throw err("NOT_FOUND", "não existe: " + dir);
    throw err("INTERNAL", e.message);
  }
  // se for symlink p/ diretório, resolvemos UMA vez (informando)
  let realDir = dir, viaLink = null;
  if (st.isSymbolicLink()) {
    try { const tgt = fs.realpathSync(dir); viaLink = tgt; realDir = tgt; st = fs.statSync(tgt); }
    catch (e) { throw err("NOT_FOUND", "symlink quebrado: " + dir); }
  }
  if (!st.isDirectory()) throw err("BAD_REQUEST", "não é diretório: " + dir);

  let names;
  try { names = fs.readdirSync(realDir); }
  catch (e) {
    if (e.code === "EACCES") throw err("PERMISSION_DENIED", "sem permissão p/ listar: " + realDir);
    throw err("INTERNAL", e.message);
  }
  names.sort((a, b) => a.localeCompare(b));
  const truncated = names.length > MAX_ENTRIES;
  const entries = names.slice(0, MAX_ENTRIES).map((n) => entryInfo(realDir, n));
  // diretórios primeiro
  entries.sort((a, b) => (a.type === "dir" ? 0 : 1) - (b.type === "dir" ? 0 : 1));
  return {
    path: dir,
    real: viaLink,
    parent: dir === "/" ? null : path.dirname(dir),
    count: names.length,
    truncated,
    entries,
  };
}

function looksBinary(buf) {
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i++) { if (buf[i] === 0) return true; }
  return false;
}

/** Lê um arquivo de texto pequeno. Recusa binário/grande. */
function read(reqPath) {
  const file = safePath(reqPath);
  let st;
  try { st = fs.lstatSync(file); }
  catch (e) {
    if (e.code === "EACCES") throw err("PERMISSION_DENIED", "sem permissão: " + file);
    if (e.code === "ENOENT") throw err("NOT_FOUND", "não existe: " + file);
    throw err("INTERNAL", e.message);
  }
  let realFile = file, viaLink = null;
  if (st.isSymbolicLink()) {
    try { realFile = fs.realpathSync(file); viaLink = realFile; st = fs.statSync(realFile); }
    catch (e) { throw err("NOT_FOUND", "symlink quebrado: " + file); }
  }
  if (st.isDirectory()) throw err("BAD_REQUEST", "é diretório, não arquivo");
  if (!st.isFile()) {
    return { path: file, real: viaLink, type: "special", message: "arquivo especial (device/socket/pipe) — não legível como texto" };
  }
  // arquivos de /proc e /sys reportam size 0 mas têm conteúdo; tratamos via leitura limitada
  let fd, buf, bytes;
  try {
    fd = fs.openSync(realFile, "r");
    buf = Buffer.alloc(MAX_READ_BYTES + 1);
    bytes = fs.readSync(fd, buf, 0, MAX_READ_BYTES + 1, 0);
  } catch (e) {
    if (e.code === "EACCES") throw err("PERMISSION_DENIED", "sem permissão de leitura: " + file);
    throw err("INTERNAL", e.message);
  } finally { if (fd != null) try { fs.closeSync(fd); } catch (e) {} }

  const truncated = bytes > MAX_READ_BYTES;
  const slice = buf.slice(0, Math.min(bytes, MAX_READ_BYTES));
  if (looksBinary(slice)) {
    return { path: file, real: viaLink, type: "binary", size: Number(st.size), message: "arquivo binário — visualização desativada" };
  }
  return {
    path: file,
    real: viaLink,
    type: "text",
    size: Number(st.size),
    bytes: slice.length,
    truncated,
    content: slice.toString("utf8"),
  };
}

/** Atalhos úteis p/ a UI. */
function bookmarks() {
  const cands = ["/", "/etc", "/var/log", "/proc", "/sys", "/boot", "/home", "/root",
    "/root/screenshots", "/usr/local", "/usr/share/cyberdeck-ui", "/usr/local/lib/cyberdeck-agent"];
  return cands.filter((p) => { try { fs.lstatSync(p); return true; } catch (e) { return false; } });
}

module.exports = { list, read, bookmarks, safePath, MAX_READ_BYTES, MAX_ENTRIES };
