// Dart blaster: five darts, then a reload. There is no end of darts.
var FULL = 5;
var darts = FULL;
var busy = false;
function show() {
  item.show(busy ? "Reloading" : darts + " / " + FULL);
}
function reload() {
  if (busy || darts === FULL) return;
  busy = true;
  show();
  item.play("reload");
  item.clip("reload");
  item.after(1400, function () {
    darts = FULL;
    busy = false;
    show();
  });
}
item.on("held", function () {
  item.play("equip");
  show();
});
item.on("away", function () {
  item.play("unequip");
});
item.on("use", function () {
  if (busy) return;
  if (darts === 0) return reload();
  darts -= 1;
  item.send("dart", { speed: 14, stick: 3 });
  item.play("fire");
  item.clip("fire");
  show();
  if (darts === 0) reload();
});
item.on("second", reload);
