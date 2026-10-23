# 怎么拿到 APK

**结论先说：不用下载 Android Studio。** 用 GitHub 免费云端构建，5 分钟出包。

---

## 方案 A：GitHub Actions（推荐，零安装）

工程里已经有 `.github/workflows/build-apk.yml`，推上去就自动出 APK。

### 步骤

1. **注册 / 登录 GitHub**（免费）：https://github.com

2. **新建一个仓库**（Private 也行，免费额度够用）
   - 点右上角 `+` → `New repository`
   - 名字随便，比如 `qingyunzhi`
   - **不要**勾 "Add a README file"

3. **把 `sect-game` 目录整个传上去**

   网页上传法（不用装 Git）：
   - 进入新仓库 → `uploading an existing file`
   - 把 `sect-game` 里的**所有内容**拖进去（包括 `.github` 文件夹，可能需要显示隐藏文件）
   - 点 `Commit changes`

   或者用命令行：
   ```powershell
   cd sect-game
   git init
   git add .
   git commit -m "青云志"
   git branch -M main
   git remote add origin https://github.com/你的用户名/qingyunzhi.git
   git push -u origin main
   ```

4. **等构建**
   - 进入仓库的 `Actions` 标签
   - 会看到 `Build APK` 正在跑（黄点）
   - 大约 3~5 分钟变成绿勾

5. **下载 APK**
   - 点进那次构建
   - 页面拉到最下面 `Artifacts` → **`qingyunzhi-apk`**
   - 下载下来是个 zip，解开就是 `app-debug.apk`

6. **装到手机**
   - 传到手机（微信文件传输 / 数据线 / 网盘）
   - 点开安装，允许"未知来源"

### 如果 Actions 没自动触发

进 `Actions` → 左边选 `Build APK` → 右边 `Run workflow` → `Run workflow`。

### 注意

- 免费账号每月 2000 分钟额度，构建一次约 4 分钟，**够用几百次**
- Private 仓库同样免费
- 构建失败的话，把 Actions 里的红色日志发我，我改配置

---

## 方案 B：本地装 Android Studio

如果你更想把包留在自己电脑上：

### 下载

官网（需能访问 Google）：
> https://developer.android.com/studio

国内镜像（挑一个能开的）：

| 镜像 | 地址 |
|---|---|
| 腾讯软件源 | https://mirrors.cloud.tencent.com/AndroidSDK/ |
| 阿里云 | https://mirrors.aliyun.com/android.googlesource.com/ |
| 华为云 | https://mirrors.huaweicloud.com/android/ |

> 注意：这些镜像大多只镜像 SDK，不一定有 Android Studio 安装包本身。
> Studio 安装包最稳的还是官网。

### 体积

- 安装包：**约 1.2 GB**
- 装完（含 SDK 34 + Build Tools + 模拟器）：**约 8~10 GB**

### 安装时必须做的两件事

1. **JDK**：安装向导会推荐自带 JDK，选它就行（你机器上已有 `F:\jdk-17.0.10`，也可以指定这个）
2. **SDK 路径**：记下来，比如 `C:\Users\你\AppData\Local\Android\Sdk`

### 构建

```powershell
cd sect-game
.\tools\sync-assets.ps1

# 打开 Android Studio → File → Open → 选 android/ 目录
# 等 Gradle Sync 完成（第一次要下载依赖，几分钟）

# 然后 Build → Build Bundle(s) / APK(s) → Build APK(s)
```

或命令行：

```powershell
cd android
.\gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

### 如果提示找不到 gradle wrapper

工程里没带 `gradlew`（因为打不了包就没生成）。用 Android Studio 打开时会自动补上；
或者手动：

```powershell
# 先装 Gradle 到 PATH，然后在 android/ 下执行
gradle wrapper --gradle-version 8.7
```

---

## 方案 C：PWABuilder（不想要 Android 工程的话）

把游戏部署到任意网址（GitHub Pages / Vercel / 自己的服务器），然后：

1. 打开 https://www.pwabuilder.com
2. 输入游戏网址
3. 它会检测出 PWA，点 `Package for stores` → **Android**
4. 下载生成的 APK / AAB

优点：完全不用碰 Android 工程。
缺点：包体是它生成的模板，图标和主题可能要在它那儿调。

**GitHub Pages 部署法：**
- 仓库 `Settings` → `Pages` → Source 选 `main` 分支根目录
- 等一分钟，得到 `https://你的用户名.github.io/qingyunzhi/`
- 这个地址既能玩，也能喂给 PWABuilder

---

## 三条路怎么选

| | 耗时 | 需要装什么 | 产出 |
|---|---|---|---|
| **A. GitHub Actions** | 5 分钟 | 只需要 GitHub 账号 | 真正的 APK |
| B. Android Studio | 30 分钟~1 小时 | 10 GB 磁盘 + 1.2 GB 下载 | 真正的 APK |
| C. PWABuilder | 10 分钟 | 一个能访问的网址 | 真正的 APK |

**我推荐 A。** 你只要有个 GitHub 账号，全程不用装任何东西。

---

## 为什么我这边做不出来

- 这台机器**没有 Android SDK**，也没有 Gradle
- **完全断网**（连 baidu.com 都连不上，`web fetch` 也失败）
- 所以既装不了工具链，也下载不了

代码和工程我都写好了，缺的只是一台能联网、有工具链的机器。
