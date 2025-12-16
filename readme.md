# Card madness

Multiplayer card game prototype built with **Vue 3 (Vite)** on the client and a **Node.js + Socket.IO** server.

## Features

- Create and join lobbies  
- Real-time lobby state with websockets (players, phases)  
- Preconfigured card packs **(Coming later)**
- More to come



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

## Disclaimer

This is an experimental project. I love writing code, but for this project the focus is on functionality and outcome rather than security or real-world usage. The goal is to create a fun game to play with friends, not to sell or host for a larger audience. Read the AI disclaimer to make your own assessment of how this project may be useful to you.

## AI Disclaimer
For this project (Card Madness), I use AI tools in a supportive role: Suno for music creation, Codex for code suggestions, and ChatGPT for productivity and inspiration. While these tools influence the overall product, all design decisions, UI/UX, implementation, and final responsibility remain entirely my own.
This project also serves as an experiment to explore how AI can support a developer in a controlled and safe environment. This project is provided as-is; please make a considered and informed decision about its use.