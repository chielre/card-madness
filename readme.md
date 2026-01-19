
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
> Card Madness is currently under active development. While this notice is present, Card Madness may not run reliably on your machine.
 
## Why?
So far, I haven’t found a good, modern, and easy way to play Cards Against Humanity with friends online. Existing solutions require you to register, pay, or are limited in the features they offer. That’s why I decided to contribute to the open-source community by building a fun game that does exactly what it promises, for free.

## Planned features

- Create and join lobbies without registration ✅
- Pre-configured packs and [community driven packs](https://github.com/chielre/card-madness-packs) ✅
- Lobby settings (rounds, white cards etc.) ❌
- Personalised black & white cards based on player names ✅
- Scoreboard and game results ✅
- Audience selection ❌
- Multi language gameplay ❌
- First CZAR selection following the official rules (and more)❌

## Getting Started
This repository consists of a client and a websocket server. To build them you'll need NodeJS. Go to the [official Node.js website](https://nodejs.org/), download the installer and follow the steps to install NodeJS on your device. The console features are tested on a [Git BASH](https://git-scm.com/install/) terminal, other terminals may work but are at the moment untested. 


### Client installation
Install dependencies
```BASH
cd card-madness
npm install
```

After installing run:
```BASH
npm run build
```

For development run:
```BASH
npm run dev
```

### Server installation
Install dependencies
```BASH
cd card-madness/server
npm install
```
After installing run:
```BASH
npm run start
```

## Install packs
You are free to create, use and sell your own packs without restriction. Our official community packs are **strictly non-commercial** and therefore not bundled with this repository. In a non-commercial context, you may install [our community packs](https://github.com/chielre/card-madness-packs) via the following command: 

```BASH
npm run install-packs
```



## AI Disclaimer
For this project (Card Madness), I use as a experienced webdeveloper AI tools in a supportive role: Suno for music creation, Codex for code suggestions, and ChatGPT for productivity and inspiration. While these tools influence the overall product, all design decisions including UI/UX, front and back-end code, and final responsibility remain entirely my own. 
This project serves as an experiment to explore how AI can support me as a developer in a controlled and safe environment. This project is provided as-is; please make a considered and informed decision about its use.