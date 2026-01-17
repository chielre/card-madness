
<p align="center"><img src="https://chielreijnen.nl/cardmadness/logo.png" width="200" alt="Logo"></p>
<p align="center">
<a href="https://github.com/chielre/card-madness/issues">
    <img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/chielre/card-madness">
</a>
 <a href="https://github.com/chielre/card-madness/graphs/contributors">
    <img src="https://img.shields.io/github/contributors-anon/chielre/card-madness?color=yellow&style=flat-square" alt="contributors" style="height: 20px;">
</a>
<img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/chielre/card-madness">
<a href="https://github.com/chielre/card-madness/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/chielre/card-madness?color=91bf09" alt="License">
</a>
</p>

A **mad** HTML5 multiplayer card game based on Card Against Humanity. Built in **Vue 3**, **GSAP**, **Node.js** and **Socket.IO**.

> [!IMPORTANT]
> Card Madness is currently under active development. Cloning this repository may not provide a fully working game or a functional server. While this notice is present, Card Madness may not run reliably on your machine. 
 
## Why?
So far, I haven’t found a good, modern, and easy way to play Cards Against Humanity with friends online. Existing solutions require you to register, pay, or are limited in the features they offer. That’s why I decided to contribute to the open-source community by building a fun game that does exactly what it promises, for free.

## Planned features

- Create and join lobbies without registration ✅
- Pre-configured card packs ✅
- Lobby settings (rounds, white cards etc.) ❌
- Personalised cards based on players ✅
- Multiplayer via websockets ✅
- Scoreboard and round results ❌
- Card czar selection ✅
- audience selection ❌
- Multi language gameplay ❌
- Community packs ✅

## Installation on Windows
For this project you'll need NodeJS. Go to the [official Node.js website](https://nodejs.org/), download the installer and follow the steps to install NodeJS on your device.


#### Client
Install dependencies in ``package.json``:
```BASH
cd card-madness
npm install
```
After installing run:
```BASH
npm run build
```

Or if you want to code:
```BASH
npm run dev
```

#### Server
Install dependencies in ``package.json``:
```BASH
cd card-madness/server
npm install
```
After installing run:
```BASH
npm run dev
```

The server will take over the console and will accept websocket connections on the provided port.

## Install packs

This repository does not contain any packs by default. You are free to create your own packs.
Alternatively, in a strictly non-commercial context, you may install [the community created packs](https://github.com/chielre/card-madness).
> [!IMPORTANT]
> Community packs are licensed under Creative Commons Attribution–NonCommercial–ShareAlike 4.0 (CC BY-NC-SA 4.0) and may not be used for commercial purposes.

Run the install script from the root:
```BASH
cd card-madness
npm run install-packs
```

### Automatic installation
Refer to the .env files to automatically download and install packs during the build process.

## Disclaimer

This is an experimental project. I love writing code, but for this project the focus is on functionality and outcome rather than security or real-world usage. The goal is to create a fun game to play with friends, not to sell or host for a larger audience. Read the AI disclaimer to make your own assessment of how this project may be useful to you.

## AI Disclaimer
For this project (Card Madness), I use as a experienced webdeveloper AI tools in a supportive role: Suno for music creation, Codex for code suggestions, and ChatGPT for productivity and inspiration. While these tools influence the overall product, all design decisions including UI/UX, front and back-end code, and final responsibility remain entirely my own. 
This project serves as an experiment to explore how AI can support me as a developer in a controlled and safe environment. This project is provided as-is; please make a considered and informed decision about its use.
