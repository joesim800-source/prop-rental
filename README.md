# Prop Rental · 租房房源簿

A listing and deal app for property agents in Malaysia: rental and subsale listings, customer messages and PDFs that hide the owner's details and unit address, booking forms (Letter of Confirmation for Rent), tenancy agreement drafts, deal progress, stamping deadlines, renewal reminders and viewing reminders. Chinese, Bahasa Melayu and English.

物业代理用的房源和交易 App：出租和出售房源、发给顾客的讯息和 PDF（隐藏屋主资料和门牌地址）、Booking Form（确认租房信）、租约草稿、交易进度、盖印花期限、续约提醒和看房提醒。支持中文、马来文、英文。

## Files

| File | What it is |
|---|---|
| `index.html` | The whole app |
| `shim.js` | Saves data in this browser (IndexedDB) when the app runs on its own website |
| `manifest.webmanifest`, `icons/` | App name and icon for "Add to Home Screen" |

## Publish with GitHub Pages

Settings → Pages → Source: **Deploy from a branch** → Branch: `main`, folder `/ (root)` → Save. The site appears at `https://<your-username>.github.io/prop-rental/` after a minute or two.

## Where the data is kept

On the website, every phone or computer keeps its own data in its browser. Nothing is sent to a server, and devices do not sync. Use **Back up data** in Settings (gear icon, top right) regularly, and **Restore backup** to move the data to a new phone. Clearing the browser's site data deletes it.

网站版的资料只存在每台手机或电脑的浏览器里，不会上传到服务器，各台手机之间也不会同步。请定期在设置（右上角齿轮）里按「备份资料」，换手机时用「还原备份」。清除浏览器网站资料会把资料删掉。

## Not available on the website version

- Phone push notifications for renewals and viewings (these run only with the Claude version). The reminders still show inside the app.
- Built-in Claude AI. Instead, add your own AI key in Settings → AI connection (Anthropic, OpenAI, Google Gemini or any OpenAI-compatible service). The key stays on that phone. Voice files need OpenAI or Gemini.
