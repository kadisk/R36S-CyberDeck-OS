// webpack.config.js — bundle ÚNICO file://-safe para o kiosk do R36S.
// publicPath './' + sem code-splitting => um só JS com caminho relativo; CSS injetado
// via style-loader (sem arquivo externo) — o Chromium bloqueia ES modules por file://,
// então NÃO usamos type=module nem chunks dinâmicos.
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    publicPath: "./",
    clean: true,
  },
  resolve: { extensions: [".ts", ".tsx", ".js", ".jsx"] },
  module: {
    rules: [
      { test: /\.[jt]sx?$/, exclude: /node_modules/, use: "babel-loader" },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
  optimization: { splitChunks: false, runtimeChunk: false },
  performance: { hints: false },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      inject: "body",
      scriptLoading: "blocking",
    }),
  ],
};
