# iPad 主屏幕启动与横屏游玩

使用 Safari 打开 https://suren123.github.io/3D-Game/ ，从分享菜单选择“添加到主屏幕”。较新的 iPadOS 如果显示“作为 Web App 打开 / Open as Web App”，请开启。之后从主屏幕的小车图标启动，才进入没有 Safari 地址栏的独立窗口。旧图标如果仍打开 Safari，需重新添加。

直接在 Safari 标签页或微信内置浏览器打开网址时，地址栏和工具栏由浏览器管理。网页不能自动移除这些浏览器界面。系统状态栏、主屏幕指示条及系统手势由 iPadOS 管理。

本项目声明横屏显示，但 Safari 不可靠支持网页锁定设备方向。竖屏时游戏会提示“把 iPad 横过来玩”并暂停游戏输入；横过来后恢复。系统旋转锁开启时，需要用户关闭旋转锁，网页不能替用户操作该设置。手动暂停和退后台暂停不会被横屏切换擅自解除。

配置包含 `manifest.webmanifest` 的 standalone/id/start_url/scope、本地应用图标、Apple 启动兼容标记、安全区和动态视口。所有路径支持 GitHub Pages 的 `/3D-Game/` 子目录。没有加入 Service Worker；本次加载完成后可断网游玩，关闭后离线重开不在本轮范围。

## 验证范围

自动化检查静态声明、图标、相对路径、竖屏阻止误触、横屏恢复与侧栏布局。云端 Chromium 无法代替真实 iPadOS 的添加主屏幕界面；最终独立窗口启动需在 iPad 上确认。

依据：[Apple iPad 用户指南](https://support.apple.com/guide/ipad/bookmark-favorite-webpages-ipadc602b75b/ipados)、[WebKit 主屏幕 Web App](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[MDN 方向锁兼容数据](https://github.com/mdn/browser-compat-data/blob/main/api/ScreenOrientation.json)。
