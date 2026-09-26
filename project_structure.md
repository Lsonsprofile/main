# 📁 coding - Project Structure

*Generated on: 9/26/2026, 5:04:21 AM*

## 📋 Quick Overview

| Metric | Value |
|--------|-------|
| 📄 Total Files | 78 |
| 📁 Total Folders | 19 |
| 🌳 Max Depth | 3 levels |
| 🛠️ Tech Stack | CSS, Node.js |

## ⭐ Important Files

- 🟡 🚫 **.gitignore** - Git ignore rules
- 🟡 🔒 **package-lock.json** - Dependency lock
- 🔴 📦 **package.json** - Package configuration
- 🔴 📖 **README.md** - Project documentation

## 📊 File Statistics

### By File Type

- 📜 **.js** (JavaScript files): 37 files (47.4%)
- 📄 **.ejs** (Other files): 30 files (38.5%)
- ⚙️ **.json** (JSON files): 2 files (2.6%)
- 🎨 **.css** (Stylesheets): 2 files (2.6%)
- 🖼️ **.jpeg** (JPEG images): 2 files (2.6%)
- 📄 **.example** (Other files): 1 files (1.3%)
- 🚫 **.gitignore** (Git ignore): 1 files (1.3%)
- 🖼️ **.png** (PNG images): 1 files (1.3%)
- 🎨 **.svg** (SVG images): 1 files (1.3%)
- 📖 **.md** (Markdown files): 1 files (1.3%)

### By Category

- **JavaScript**: 37 files (47.4%)
- **Other**: 31 files (39.7%)
- **Assets**: 4 files (5.1%)
- **Config**: 2 files (2.6%)
- **Styles**: 2 files (2.6%)
- **DevOps**: 1 files (1.3%)
- **Docs**: 1 files (1.3%)

### 📁 Largest Directories

- **root**: 78 files
- **src**: 32 files
- **views**: 30 files
- **src\controllers**: 10 files
- **views\partials**: 10 files

## 🌳 Directory Structure

```
coding/
├── 📄 .env.example
├── 🟡 🚫 **.gitignore**
├── 📜 app.js
├── 🟡 🔒 **package-lock.json**
├── 🔴 📦 **package.json**
├── 🌐 public/
│   ├── 🎨 css/
│   │   ├── 🎨 html-editor.css
│   │   └── 🎨 main.css
│   ├── 📂 js/
│   │   ├── 📜 html-editor.js
│   │   ├── 📜 lesson-chat.js
│   │   └── 📜 main.js
│   └── 📂 uploads/
│   │   ├── 🖼️ 1789904365713-154804525.jpeg
│   │   ├── 🖼️ 1790298384962-688005648.png
│   │   ├── 🎨 1790298426252-912026904.svg
│   │   ├── 🖼️ 1790298608195-283983954.jpeg
│   │   └── 📂 avatars/
├── 🔴 📖 **README.md**
├── 📜 server.js
├── 📁 src/
│   ├── 📂 controllers/
│   │   ├── 📜 accountController.js
│   │   ├── 📜 adminController.js
│   │   ├── 📜 authController.js
│   │   ├── 📜 commentController.js
│   │   ├── 📜 lessonController.js
│   │   ├── 📜 mediaController.js
│   │   ├── 📜 pageController.js
│   │   ├── 📜 progressController.js
│   │   ├── 📜 settingsController.js
│   │   └── 📜 sitemapController.js
│   ├── 📂 data/
│   │   └── 📜 componentRegistry.js
│   ├── 📂 db/
│   │   └── 📜 connect.js
│   ├── 📂 middleware/
│   │   ├── 📜 auth.js
│   │   ├── 📜 rateLimit.js
│   │   └── 📜 security.js
│   ├── 📂 models/
│   │   ├── 📜 chatModel.js
│   │   ├── 📜 commentModel.js
│   │   ├── 📜 mediaModel.js
│   │   ├── 📜 pageModel.js
│   │   ├── 📜 progressModel.js
│   │   ├── 📜 settingsModel.js
│   │   └── 📜 userModel.js
│   ├── 📂 realtime/
│   │   └── 📜 chatSocket.js
│   ├── 📂 routes/
│   │   ├── 📜 adminRoutes.js
│   │   ├── 📜 authRoutes.js
│   │   └── 📜 publicRoutes.js
│   └── 🔧 utils/
│   │   ├── 📜 componentState.js
│   │   ├── 📜 makeAdmin.js
│   │   ├── 📜 platformInject.js
│   │   ├── 📜 resetHome.js
│   │   ├── 📜 sanitize.js
│   │   └── 📜 seed.js
└── 📂 views/
│   ├── 📂 admin/
│   │   ├── 📄 comments.ejs
│   │   ├── 📄 dashboard.ejs
│   │   ├── 📄 media.ejs
│   │   ├── 📄 page-edit.ejs
│   │   ├── 📄 page-form.ejs
│   │   ├── 📄 pages.ejs
│   │   ├── 📄 profile.ejs
│   │   ├── 📄 settings.ejs
│   │   └── 📄 users.ejs
│   ├── 📂 auth/
│   │   ├── 📄 login.ejs
│   │   └── 📄 register.ejs
│   ├── 📂 partials/
│   │   ├── 📄 admin-block.ejs
│   │   ├── 📄 admin-nav.ejs
│   │   ├── 📄 canvas-block.ejs
│   │   ├── 📄 custom-html-frame.ejs
│   │   ├── 📄 footer.ejs
│   │   ├── 📄 head.ejs
│   │   ├── 📄 lesson-chat.ejs
│   │   ├── 📄 lesson-discussion.ejs
│   │   ├── 📄 nav.ejs
│   │   └── 📄 render-block.ejs
│   └── 🌐 public/
│   │   ├── 📄 403.ejs
│   │   ├── 📄 404.ejs
│   │   ├── 📄 500.ejs
│   │   ├── 📄 about.ejs
│   │   ├── 📄 account.ejs
│   │   ├── 📄 contact.ejs
│   │   ├── 📄 lesson.ejs
│   │   ├── 📄 lessons.ejs
│   │   └── 📄 site-page.ejs
```

## 📖 Legend

### File Types
- 📄 Other: Other files
- 🚫 DevOps: Git ignore
- 📜 JavaScript: JavaScript files
- ⚙️ Config: JSON files
- 🎨 Styles: Stylesheets
- 🖼️ Assets: JPEG images
- 🖼️ Assets: PNG images
- 🎨 Assets: SVG images
- 📖 Docs: Markdown files

### Importance Levels
- 🔴 Critical: Essential project files
- 🟡 High: Important configuration files
- 🔵 Medium: Helpful but not essential files
