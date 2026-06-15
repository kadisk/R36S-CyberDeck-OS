# Análise de Device Tree — R36S (referência ArkOS)

> Gerado por `scripts/identify-r36s-dtb.sh` em 2026-06-14T21:45:21-03:00.
> DTBs decodificados de `/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/arkos-reference/dtb` (extraídos da imagem ArkOS, read-only).

## DTBs encontrados

- `rg351mp-kernel.dtb` — 61363 bytes — sha256 `3eb075230cdeaf4504a31df902a73e0e85d115bf2a9b3b390990fa7f3860230a`
- `rg351p-kernel.dtb` — 61363 bytes — sha256 `3eb075230cdeaf4504a31df902a73e0e85d115bf2a9b3b390990fa7f3860230a`
- `rk3326-r35s-linux.dtb` — 89630 bytes — sha256 `893d6026bacf0752a56661c21ed8584aab4a9baf8841dc5e5900969e597611db`

## rg351mp-kernel.dtb

- **model:** ODROID-GO2 for linux based on Rockchip rk3326
- **compatible (raiz):** "rockchip,rk3326-odroidgo2-linux\0rockchip,rk3326"

### Referências de hardware encontradas

| keyword | ocorrências |
|---------|-------------|
| `rk3326` | 4 |
| `odroidgo` | 1 |
| `odroid-go` | 1 |
| `mipi` | 7 |
| `panel` | 4 |
| `backlight` | 5 |
| `mali` | 4 |
| `rk817` | 14 |
| `saradc` | 4 |
| `adc` | 11 |
| `dwmmc` | 3 |
| `cortex-a35` | 4 |
| `kd35t133` | 1 |
| `elida` | 1 |
| `vop` | 4 |
| `dsi` | 7 |

### Nós de interesse (trecho)

```
279:			route-dsi {
391:			pd_gpu@14 {
712:		pmic@20 {
717:			pinctrl-names = "default\0pmic-sleep\0pmic-power-off\0pmic-reset";
726:			pmic-reset-func = <0x01>;
931:					regulator-name = "vcc_backlight";
982:			battery {
999:			charger {
1000:				compatible = "rk817,charger";
1290:		gpu-thermal {
1624:	gpu@ff400000 {
1643:			thermal-zone = "gpu-thermal";
1647:	gpu-opp-table {
1769:	dsi@ff450000 {
1770:		compatible = "rockchip,px30-mipi-dsi";
1803:		panel@0 {
1804:			compatible = "elida,kd35t133\0simple-panel-dsi";
1806:			backlight = <0x9f>;
1807:			backlight-supply = <0xa0>;
1823:			dsi,flags = <0xa03>;
1824:			dsi,format = <0x00>;
1825:			dsi,lanes = <0x04>;
1826:			panel-init-sequence = <0x5960111 0x5320129>;
1827:			panel-exit-sequence = <0x5000128 0x5000110>;
1852:	vop@ff460000 {
1853:		compatible = "rockchip,px30-vop-big";
1859:		clock-names = "aclk_vop\0dclk_vop\0hclk_vop";
1893:		interrupt-names = "vopb_mmu";
3034:		pmic {
3036:			pmic_int {
3226:		battery {
3227:			label = "battery_full";
3233:	backlight {
3234:		compatible = "pwm-backlight";
```

## rg351p-kernel.dtb

- **model:** ODROID-GO2 for linux based on Rockchip rk3326
- **compatible (raiz):** "rockchip,rk3326-odroidgo2-linux\0rockchip,rk3326"

### Referências de hardware encontradas

| keyword | ocorrências |
|---------|-------------|
| `rk3326` | 4 |
| `odroidgo` | 1 |
| `odroid-go` | 1 |
| `mipi` | 7 |
| `panel` | 4 |
| `backlight` | 5 |
| `mali` | 4 |
| `rk817` | 14 |
| `saradc` | 4 |
| `adc` | 11 |
| `dwmmc` | 3 |
| `cortex-a35` | 4 |
| `kd35t133` | 1 |
| `elida` | 1 |
| `vop` | 4 |
| `dsi` | 7 |

### Nós de interesse (trecho)

```
279:			route-dsi {
391:			pd_gpu@14 {
712:		pmic@20 {
717:			pinctrl-names = "default\0pmic-sleep\0pmic-power-off\0pmic-reset";
726:			pmic-reset-func = <0x01>;
931:					regulator-name = "vcc_backlight";
982:			battery {
999:			charger {
1000:				compatible = "rk817,charger";
1290:		gpu-thermal {
1624:	gpu@ff400000 {
1643:			thermal-zone = "gpu-thermal";
1647:	gpu-opp-table {
1769:	dsi@ff450000 {
1770:		compatible = "rockchip,px30-mipi-dsi";
1803:		panel@0 {
1804:			compatible = "elida,kd35t133\0simple-panel-dsi";
1806:			backlight = <0x9f>;
1807:			backlight-supply = <0xa0>;
1823:			dsi,flags = <0xa03>;
1824:			dsi,format = <0x00>;
1825:			dsi,lanes = <0x04>;
1826:			panel-init-sequence = <0x5960111 0x5320129>;
1827:			panel-exit-sequence = <0x5000128 0x5000110>;
1852:	vop@ff460000 {
1853:		compatible = "rockchip,px30-vop-big";
1859:		clock-names = "aclk_vop\0dclk_vop\0hclk_vop";
1893:		interrupt-names = "vopb_mmu";
3034:		pmic {
3036:			pmic_int {
3226:		battery {
3227:			label = "battery_full";
3233:	backlight {
3234:		compatible = "pwm-backlight";
```

## rk3326-r35s-linux.dtb

- **model:** Rockchip RK3326
- **compatible (raiz):** "rockchip,rk3326-odroidgo3-linux\0rockchip,rk3326"

### Referências de hardware encontradas

| keyword | ocorrências |
|---------|-------------|
| `rk3326` | 4 |
| `odroidgo` | 6 |
| `mipi` | 8 |
| `panel` | 7 |
| `backlight` | 4 |
| `mali` | 4 |
| `rk817` | 24 |
| `joypad` | 6 |
| `saradc` | 5 |
| `adc` | 20 |
| `dwmmc` | 6 |
| `cortex-a35` | 4 |
| `kd35t133` | 1 |
| `elida` | 1 |
| `vop` | 15 |
| `dsi` | 14 |

### Nós de interesse (trecho)

```
516:			route-dsi {
643:			pd_gpu@14 {
982:		pmic@20 {
987:			pinctrl-names = "default\0pmic-sleep\0pmic-power-off\0pmic-reset";
996:			pmic-reset-func = <0x01>;
1267:			battery {
1268:				compatible = "rk817,battery";
1284:			charger {
1285:				compatible = "rk817,charger";
1576:		gpu-thermal {
1910:	gpu@ff400000 {
1929:			thermal-zone = "gpu-thermal";
1933:	gpu-opp-table {
2038:	dsi@ff450000 {
2039:		compatible = "rockchip,px30-mipi-dsi";
2073:		panel@0 {
2074:			compatible = "elida,kd35t133\0simple-panel-dsi";
2076:			backlight = <0x99>;
2090:			dsi,flags = <0xa03>;
2091:			dsi,format = <0x00>;
2092:			dsi,lanes = <0x04>;
2093:			panel-init-sequence = <0x5960111 0x5320129>;
2094:			panel-exit-sequence = <0x5140128 0x50a0110>;
2153:	vop@ff460000 {
2154:		compatible = "rockchip,px30-vop-big";
2160:		clock-names = "aclk_vop\0dclk_vop\0hclk_vop";
2195:		interrupt-names = "vopb_mmu";
3435:		pmic {
3437:			pmic_int {
3546:	odroidgo3-joypad {
3547:		compatible = "odroidgo3-joypad";
3552:		joypad-name = "GO-Super Gamepad";
3553:		joypad-product = <0x1100>;
3554:		joypad-revision = <0x100>;
3699:	backlight {
3700:		compatible = "pwm-backlight";
3755:		route_dsi = "/display-subsystem/route/route-dsi";
3777:		lvds_in_vopb = "/syscon@ff140000/lvds/ports/port@0/endpoint@0";
3779:		rgb_in_vopb = "/syscon@ff140000/rgb/ports/port@0/endpoint@0";
3788:		rk817 = "/i2c@ff180000/pmic@20";
```

## Observações

- O DTB ativo do aparelho é apontado pelo `boot.ini` da partição BOOT.
- Para o CyberDeck OS, este `compatible`/`model` deve ser reproduzido pelo
  kernel/DTB do rootfs final (ver docs/boot/boot-flow.md).
