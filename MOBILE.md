# 装到手机上

这个游戏是纯静态网页，有三种装法，从简到繁。

---

## 一、直接在手机浏览器里玩（零安装）

把整个 `sect-game` 目录放到任意静态服务器上（GitHub Pages、自己的服务器、家里 NAS 都行），
手机打开那个地址就能玩。

存档在浏览器的 localStorage 里，**换浏览器或清缓存会丢**。

---

## 二、装成 PWA（推荐，最省事）

已经在仓库里配好了，不需要额外操作。

### Android（Chrome / Edge）

1. 手机打开游戏地址
2. 右上角菜单 → **「添加到主屏幕」/「安装应用」**
3. 桌面上会出现「青云志」图标

装完之后：
- 全屏运行，没有地址栏
- **断网也能玩**（Service Worker 缓存了全部文件）

### iOS（Safari）

1. Safari 打开游戏地址
2. 底部「分享」→ **「添加到主屏幕」**

iOS 上的限制：没有真正的 Service Worker 离线，但 Safari 的缓存通常也够用。

### 要求

- **必须走 http/https**。`file://` 双击打开也能玩，但装不了 PWA（浏览器不给注册 Service Worker）。

最简的本地测试：

```powershell
cd sect-game
npx serve .
# 或者 python -m http.server 8080
```

然后手机连同一个 WiFi，访问 `http://电脑IP:8080`。

> 注意：Chrome 只在 `https` 或 `localhost` 下允许安装 PWA。
> 局域网 `http://192.168.x.x` 可能不弹安装按钮——这时候用方案三。

---

## 三、打包成 APK

仓库里带了完整的 Android 工程，在 `android/` 目录。

### 需要什么

- **Android Studio**（自带 SDK + Gradle）
- **JDK 17**（Android Studio 通常自带）

### 步骤

```powershell
# 1. 把游戏文件同步进 assets
cd sect-game
.\tools\sync-assets.ps1

# 2. 用 Android Studio 打开 android/ 目录，等它同步完

# 3. 出包
cd android
.\gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

拷到手机上点安装（需要允许"未知来源"）。

### 或者用 Android Studio 图形界面

1. `File → Open` 选 `android/` 目录
2. 等 Gradle Sync 完成
3. `Build → Build Bundle(s) / APK(s) → Build APK(s)`
4. 右下角弹窗点 `locate`

### 技术细节

- 包名 `com.qingyun.zongmen`，minSdk 24（Android 7.0+）
- 用 `WebViewAssetLoader` 从 `https://appassets.androidplatform.net/` 加载，
  **不是** `file://` —— 因为 file:// 会被当成 opaque origin，localStorage 直接不可用，存档会废
- 全屏沉浸式，刘海屏安全区已适配
- APK 内不注册 Service Worker（资源本来就是本地的，注册了反而会让更新读旧缓存）
- 卸载 App 会清掉存档

### 改完代码要重新同步

```powershell
.\tools\sync-assets.ps1
```

然后是重新构建。

---

## 手机上玩起来什么样

已经针对手机调过：

- 标签栏可以左右滑（9 个标签在窄屏放不下）
- 按钮最小 44px，手指按得准
- 弹窗从底部弹出，可以滚
- 刘海、圆角、手势条都留了安全区
- 横屏时内容居中，不会拉太宽

**没在真机上目视验证过**——这个环境里浏览器起不来。
如果发现哪里挤了、字小了、按钮点不到，告诉我具体是哪一屏，我来调。
