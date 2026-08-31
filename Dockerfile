# 线上演示部署：静态站 + nginx（本项目是纯前端游戏，本地双击 game.html 即可玩；
# Docker 仅用于把 game.html 挂到网上给别人看）
FROM nginx:alpine
COPY game.html /usr/share/nginx/html/index.html
EXPOSE 80
