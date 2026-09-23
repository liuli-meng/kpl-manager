git add src/js/players.js src/js/season.js src/js/transfer.js tests/run.js tests/verify-noswallow.js game.html
git commit -m "修「选手被吞」：租借回流/卖出挂账/关窗清表/市场重建不再让人从联盟蒸发"
if ($?) { git push }
git status -sb
