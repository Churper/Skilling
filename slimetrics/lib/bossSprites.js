// ============================================================
//  PIXEL BOSSES — 64×64 sprites, drawn procedurally on canvas
//  Style: OSRS-ish, but with a bit more pixel headroom.
// ============================================================

const W = 64, H = 64;

// ---- low-level helpers --------------------------------------
const px = (ctx, x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x|0, y|0, 1, 1); };
const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x|0, y|0, w|0, h|0); };
const disc = (ctx, cx, cy, r, c) => {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x*x + y*y <= r*r) ctx.fillRect((cx+x)|0, (cy+y)|0, 1, 1);
};
const ring = (ctx, cx, cy, r, c) => {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x*x + y*y;
      if (d <= r*r && d >= (r-1)*(r-1)) ctx.fillRect((cx+x)|0, (cy+y)|0, 1, 1);
    }
};
const ellipse = (ctx, cx, cy, rx, ry, c) => {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++)
      if ((x*x)/(rx*rx) + (y*y)/(ry*ry) <= 1) ctx.fillRect((cx+x)|0, (cy+y)|0, 1, 1);
};
const ellipseOutline = (ctx, cx, cy, rx, ry, c) => {
  ctx.fillStyle = c;
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const v = (x*x)/(rx*rx) + (y*y)/(ry*ry);
      const v2 = ((Math.abs(x)+1)*(Math.abs(x)+1))/(rx*rx) + ((Math.abs(y)+1)*(Math.abs(y)+1))/(ry*ry);
      if (v <= 1 && v2 > 1) ctx.fillRect((cx+x)|0, (cy+y)|0, 1, 1);
    }
};
const line = (ctx, x0, y0, x1, y1, c) => {
  let x = x0|0, y = y0|0;
  const X1 = x1|0, Y1 = y1|0;
  const dx = Math.abs(X1-x), dy = Math.abs(Y1-y);
  const sx = x < X1 ? 1 : -1, sy = y < Y1 ? 1 : -1;
  let err = dx-dy;
  ctx.fillStyle = c;
  for (let i = 0; i < 200; i++) {
    ctx.fillRect(x, y, 1, 1);
    if (x === X1 && y === Y1) break;
    const e2 = 2*err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
};
const lineW = (ctx, x0, y0, x1, y1, c, w=2) => {
  // thick line by drawing parallel lines
  for (let i = 0; i < w; i++) {
    line(ctx, x0, y0+i, x1, y1+i, c);
    line(ctx, x0+i, y0, x1+i, y1, c);
  }
};
const floorShadow = (ctx) => ellipse(ctx, 32, 61, 19, 2, 'rgba(0,0,0,0.45)');

// ============================================================
// 1) VERDANT COBRA — thin green pillar, diamond hooded head
// ============================================================
function drawCobra(ctx) {
  const cream = '#f5e4b2', creamD = '#c8b078', creamDD = '#8b7440';
  const grn = '#3aa53a', grnD = '#1f5a23', grnDD = '#0a2811';
  const grnL = '#6dca4a', grnH = '#a8e87a';
  const red = '#c63a3a', redD = '#7a1818';
  const blk = '#070808', wht = '#fff8e0';
  const yel = '#e8c038';

  floorShadow(ctx);

  // ---------- THIN green pillar body ----------
  // body from y=24 (just below head/chin) to y=60
  for (let y = 24; y <= 60; y++) {
    let halfW;
    if (y >= 56) halfW = 9;             // small base flare
    else if (y >= 50) halfW = 7 + ((y-50) * 0.3 | 0);
    else if (y >= 32) halfW = 7;        // straight section
    else halfW = 5 + ((y - 24) / 4 | 0); // slim under head
    // outline
    px(ctx, 32 - halfW - 1, y, grnDD);
    px(ctx, 32 + halfW + 1, y, grnDD);
    // base green
    for (let dx = -halfW; dx <= halfW; dx++) px(ctx, 32 + dx, y, grn);
    // left highlight
    px(ctx, 32 - halfW, y, grnD);
    px(ctx, 32 - halfW + 1, y, grnL);
    // right shadow
    px(ctx, 32 + halfW, y, grnD);
    // CREAM belly stripe down the center
    const bellyHalf = Math.max(1, halfW - 3);
    for (let dx = -bellyHalf; dx <= bellyHalf; dx++) px(ctx, 32 + dx, y, cream);
    px(ctx, 32 - bellyHalf - 1, y, creamD);
    px(ctx, 32 + bellyHalf + 1, y, creamD);
  }

  // ---------- Horizontal scale segment rings ----------
  for (const y of [30, 37, 44, 51, 58]) {
    let halfW;
    if (y >= 56) halfW = 9;
    else if (y >= 50) halfW = 7 + ((y-50) * 0.3 | 0);
    else if (y >= 32) halfW = 7;
    else halfW = 5 + ((y - 24) / 4 | 0);
    for (let dx = -halfW; dx <= halfW; dx++) px(ctx, 32 + dx, y, grnDD);
    const bellyHalf = Math.max(1, halfW - 3);
    for (let dx = -bellyHalf; dx <= bellyHalf; dx++) px(ctx, 32 + dx, y, creamDD);
  }
  // base shadow line
  for (let x = 21; x <= 43; x++) px(ctx, x, 61, grnDD);

  // ---------- HEAD — rounded hooded head ----------
  // Round dome shape — wider at hood (y=10-14), gently narrowing to chin
  for (let y = 6; y <= 23; y++) {
    let halfW;
    // smooth oval profile, widest around y=12-13
    const t = (y - 14) / 9;  // -1 at top, +1 at bottom-ish
    halfW = Math.round(Math.sqrt(Math.max(0, 1 - t*t)) * 9);
    // narrow the chin (y=20-23)
    if (y >= 20) halfW = Math.max(3, 7 - (y - 20));
    halfW = Math.max(2, halfW);
    // outline
    px(ctx, 32 - halfW - 1, y, grnDD);
    px(ctx, 32 + halfW + 1, y, grnDD);
    for (let dx = -halfW; dx <= halfW; dx++) px(ctx, 32 + dx, y, grn);
    // left highlight
    px(ctx, 32 - halfW, y, grnD);
    if (y < 12) px(ctx, 32 - halfW + 1, y, grnH);
    else px(ctx, 32 - halfW + 1, y, grnL);
    // right shadow
    px(ctx, 32 + halfW, y, grnD);
  }

  // hood markings — V chevron pointing down
  px(ctx, 32, 8, grnDD);
  px(ctx, 31, 9, grnDD); px(ctx, 33, 9, grnDD);
  px(ctx, 30, 10, grnDD); px(ctx, 34, 10, grnDD);
  // brighter inner highlight
  px(ctx, 32, 9, grnH); px(ctx, 31, 10, grnH); px(ctx, 33, 10, grnH);

  // EYES — beady black with yellow rim, set on the wide hood
  // left eye
  rect(ctx, 25, 13, 3, 2, blk);
  px(ctx, 24, 13, yel); px(ctx, 28, 13, yel);
  px(ctx, 25, 12, yel); px(ctx, 27, 12, yel);
  px(ctx, 25, 15, yel); px(ctx, 27, 15, yel);
  px(ctx, 26, 13, wht); // glint
  // right eye
  rect(ctx, 36, 13, 3, 2, blk);
  px(ctx, 35, 13, yel); px(ctx, 39, 13, yel);
  px(ctx, 36, 12, yel); px(ctx, 38, 12, yel);
  px(ctx, 36, 15, yel); px(ctx, 38, 15, yel);
  px(ctx, 37, 13, wht);

  // nostril dots on snout
  px(ctx, 30, 18, grnDD); px(ctx, 34, 18, grnDD);

  // mouth slit (open showing tongue)
  rect(ctx, 30, 20, 5, 1, blk);
  rect(ctx, 31, 21, 3, 1, '#3a0a0a');

  // forked red tongue flicking down
  px(ctx, 32, 22, red);
  px(ctx, 32, 23, red);
  px(ctx, 32, 24, red);
  // fork at bottom
  px(ctx, 31, 25, red); px(ctx, 33, 25, red);
  px(ctx, 30, 26, redD); px(ctx, 34, 26, redD);

  // small fangs visible at mouth corners
  px(ctx, 30, 21, wht); px(ctx, 34, 21, wht);
}

// ============================================================
// 2) STONE WARDEN — head + boulder shoulders + chest + short arms + legs
// ============================================================
function drawGolem(ctx) {
  const stone = '#8e6d44', stoneD = '#5a4220', stoneDD = '#2c1f0e';
  const stoneL = '#b08660', stoneH = '#d8a878';
  const moss = '#5d7a30';
  const eye = '#ff8a1c', eyeH = '#ffd884', eyeC = '#ffe9b8';
  const blk = '#08060a';
  const dirt = '#a47a3e', dirtL = '#c19350';

  // ground patch (sand circle)
  ellipse(ctx, 32, 60, 22, 3, dirt);
  ellipse(ctx, 32, 60, 21, 2, dirtL);
  ellipse(ctx, 32, 60, 18, 2, 'rgba(0,0,0,0.35)');

  // --- LEGS (short stubby boulders at bottom) ---
  // left leg
  ellipse(ctx, 24, 53, 5, 5, stoneDD);
  ellipse(ctx, 24, 53, 4, 4, stoneD);
  ellipse(ctx, 23, 52, 3, 3, stone);
  px(ctx, 22, 51, stoneL); px(ctx, 22, 50, stoneH);
  // right leg
  ellipse(ctx, 40, 53, 5, 5, stoneDD);
  ellipse(ctx, 40, 53, 4, 4, stoneD);
  ellipse(ctx, 39, 52, 3, 3, stone);
  px(ctx, 38, 51, stoneL);
  // foot pads (flatten bottoms)
  rect(ctx, 20, 56, 9, 2, stoneDD);
  rect(ctx, 21, 56, 7, 1, stoneD);
  rect(ctx, 36, 56, 9, 2, stoneDD);
  rect(ctx, 37, 56, 7, 1, stoneD);

  // --- BODY (chunky torso, connects head + legs) ---
  ellipse(ctx, 32, 38, 14, 11, stoneDD);
  ellipse(ctx, 32, 38, 13, 10, stoneD);
  ellipse(ctx, 32, 37, 12, 9, stone);
  ellipse(ctx, 28, 34, 6, 3, stoneL);
  px(ctx, 26, 32, stoneH);
  // cracks
  line(ctx, 30, 36, 31, 44, stoneDD);
  line(ctx, 33, 38, 35, 44, stoneDD);
  line(ctx, 26, 40, 25, 44, stoneDD);
  // belly band
  ellipse(ctx, 32, 45, 11, 2, stoneD);

  // --- LEFT SHOULDER boulder (overlaps body) ---
  ellipse(ctx, 16, 28, 8, 7, stoneDD);
  ellipse(ctx, 16, 27, 7, 6, stoneD);
  ellipse(ctx, 16, 26, 6, 5, stone);
  ellipse(ctx, 14, 24, 3, 2, stoneL);
  px(ctx, 13, 23, stoneH);
  line(ctx, 10, 28, 16, 24, stoneDD);
  line(ctx, 16, 24, 22, 28, stoneDD);

  // --- RIGHT SHOULDER boulder ---
  ellipse(ctx, 48, 28, 8, 7, stoneDD);
  ellipse(ctx, 48, 27, 7, 6, stoneD);
  ellipse(ctx, 48, 26, 6, 5, stone);
  ellipse(ctx, 47, 24, 2, 2, stoneL);
  line(ctx, 42, 28, 48, 24, stoneDD);
  line(ctx, 48, 24, 54, 28, stoneDD);

  // --- SHORT ARMS (just connectors from shoulder to fist, hanging at body side) ---
  // left arm — short angled stub
  for (let y = 30; y <= 40; y++) {
    const cx = 14;
    const w = 3;
    px(ctx, cx - w - 1, y, stoneDD);
    px(ctx, cx + w + 1, y, stoneDD);
    for (let dx = -w; dx <= w; dx++) px(ctx, cx + dx, y, stoneD);
    px(ctx, cx - w, y, stone);
    px(ctx, cx - w + 1, y, stoneL);
    px(ctx, cx + w, y, stoneDD);
  }
  // right arm
  for (let y = 30; y <= 40; y++) {
    const cx = 50;
    const w = 3;
    px(ctx, cx - w - 1, y, stoneDD);
    px(ctx, cx + w + 1, y, stoneDD);
    for (let dx = -w; dx <= w; dx++) px(ctx, cx + dx, y, stoneD);
    px(ctx, cx - w, y, stone);
    px(ctx, cx - w + 1, y, stoneL);
    px(ctx, cx + w, y, stoneDD);
  }

  // --- FIST BOULDERS (hanging at body side, NOT below body) ---
  // left fist
  ellipse(ctx, 13, 44, 7, 6, stoneDD);
  ellipse(ctx, 13, 44, 6, 5, stoneD);
  ellipse(ctx, 13, 43, 5, 4, stone);
  ellipse(ctx, 11, 41, 3, 2, stoneL);
  px(ctx, 10, 40, stoneH);
  line(ctx, 7, 44, 13, 40, stoneDD);
  line(ctx, 13, 40, 19, 44, stoneDD);
  // right fist
  ellipse(ctx, 51, 44, 7, 6, stoneDD);
  ellipse(ctx, 51, 44, 6, 5, stoneD);
  ellipse(ctx, 51, 43, 5, 4, stone);
  ellipse(ctx, 49, 41, 3, 2, stoneL);
  line(ctx, 45, 44, 51, 40, stoneDD);
  line(ctx, 51, 40, 57, 44, stoneDD);

  // --- HEAD (round, perched between/above shoulders) ---
  ellipse(ctx, 32, 18, 9, 8, stoneDD);
  ellipse(ctx, 32, 18, 8, 7, stoneD);
  ellipse(ctx, 32, 17, 7, 6, stone);
  ellipse(ctx, 30, 15, 4, 2, stoneL);
  px(ctx, 29, 14, stoneH);
  // moss tufts on top
  px(ctx, 28, 11, moss); px(ctx, 29, 11, moss);
  px(ctx, 32, 10, moss); px(ctx, 33, 10, moss); px(ctx, 34, 10, moss);
  px(ctx, 36, 11, moss); px(ctx, 28, 12, moss); px(ctx, 35, 12, moss);
  // eye sockets (recessed dark)
  rect(ctx, 27, 17, 4, 3, blk);
  rect(ctx, 33, 17, 4, 3, blk);
  // glowing orange eyes
  rect(ctx, 28, 18, 2, 2, eye);
  rect(ctx, 34, 18, 2, 2, eye);
  px(ctx, 28, 18, eyeC); px(ctx, 34, 18, eyeC);
  px(ctx, 27, 18, eyeH); px(ctx, 30, 18, eyeH);
  px(ctx, 33, 18, eyeH); px(ctx, 36, 18, eyeH);
  // mouth crack
  line(ctx, 29, 22, 35, 22, blk);

  // scattered small pebbles at base
  px(ctx, 14, 58, stoneDD); px(ctx, 15, 58, stoneD);
  px(ctx, 49, 58, stoneDD); px(ctx, 50, 58, stoneD);
  px(ctx, 32, 58, stoneDD);
}

// ============================================================
// 3) SLIME SOVEREIGN — flat green dome with embedded crown
// ============================================================
function drawSlimeKing(ctx) {
  const grn = '#5cc44a', grnD = '#358e36', grnDD = '#16481e';
  const grnL = '#86dc66', grnH = '#bff094';
  const gold = '#f0c238', goldD = '#a8761a', goldH = '#ffe89a';
  const ruby = '#d8333c', rubyD = '#7a1422', rubyH = '#ff7088';
  const blk = '#08120a';

  floorShadow(ctx);

  // --- FLAT slime dome (wider than tall) ---
  // dome from y=30 to y=58, very wide
  for (let y = 30; y <= 58; y++) {
    for (let x = 4; x <= 60; x++) {
      const dx = (x - 32) / 28;
      const dy = (y - 58) / 30;
      const d = dx*dx + dy*dy;
      if (d <= 1) {
        let c = grn;
        if (d > 0.92) c = grnDD;
        else if (d > 0.82) c = grnD;
        // top-left highlight band
        if (y >= 32 && y <= 40 && x >= 14 && x <= 32 && d > 0.55 && d < 0.78) c = grnL;
        if (y >= 33 && y <= 36 && x >= 16 && x <= 24) c = grnH;
        // bottom shadow band
        if (y >= 52) c = grnD;
        if (y >= 56) c = grnDD;
        px(ctx, x, y, c);
      }
    }
  }
  // little drips
  rect(ctx, 5, 50, 2, 4, grnD); px(ctx, 5, 54, grnDD); px(ctx, 6, 54, grnDD);
  rect(ctx, 57, 48, 2, 5, grnD); px(ctx, 57, 53, grnDD); px(ctx, 58, 53, grnDD);
  // bright sparkles
  rect(ctx, 18, 36, 3, 1, grnH);
  px(ctx, 22, 34, grnH); px(ctx, 16, 38, grnH);

  // --- FACE ---
  // clean cute eyes — small white circles with round black pupils
  // left eye
  disc(ctx, 25, 42, 3, blk);
  disc(ctx, 25, 42, 2, '#ffffff');
  disc(ctx, 25, 42, 1, blk);
  // right eye
  disc(ctx, 39, 42, 3, blk);
  disc(ctx, 39, 42, 2, '#ffffff');
  disc(ctx, 39, 42, 1, blk);

  // simple slit mouth "-"
  rect(ctx, 29, 50, 6, 2, grnDD);
  rect(ctx, 30, 50, 4, 1, blk);

  // --- CROWN (king's crown: gold rim, red velvet inside, gold points) ---
  // The crown sits on the slime's top.
  // 1) red velvet "cushion" inside the crown bowl (visible behind the points)
  ellipse(ctx, 32, 24, 9, 3, rubyD);
  ellipse(ctx, 32, 23, 8, 2, ruby);
  ellipse(ctx, 31, 22, 5, 1, rubyH);

  // 2) gold rim band at base (wide)
  rect(ctx, 22, 26, 20, 4, goldD);
  rect(ctx, 22, 26, 20, 3, gold);
  rect(ctx, 23, 26, 18, 1, goldH);
  // rim shadow line at the bottom
  rect(ctx, 22, 29, 20, 1, blk);

  // 3) gold points/spikes on top of the rim (3 main: 2 side + 1 tall center)
  // left side point
  rect(ctx, 23, 22, 3, 4, goldD);
  rect(ctx, 23, 22, 2, 3, gold);
  px(ctx, 24, 21, gold);
  px(ctx, 23, 22, goldH);
  // right side point
  rect(ctx, 38, 22, 3, 4, goldD);
  rect(ctx, 38, 22, 2, 3, gold);
  px(ctx, 39, 21, gold);
  px(ctx, 38, 22, goldH);
  // center tall point with a ball/finial
  rect(ctx, 30, 17, 4, 9, goldD);
  rect(ctx, 31, 17, 2, 8, gold);
  px(ctx, 31, 17, goldH);
  // ball/finial on top of center point
  disc(ctx, 32, 15, 2, goldD);
  disc(ctx, 32, 15, 1, gold);
  px(ctx, 31, 14, goldH);

  // 4) ruby gem set in the gold rim band, front-center
  rect(ctx, 30, 27, 4, 2, rubyD);
  rect(ctx, 31, 27, 2, 1, ruby);
  px(ctx, 31, 27, rubyH);

  // 5) crown outline left/right (definition)
  px(ctx, 21, 26, blk); px(ctx, 42, 26, blk);
  px(ctx, 21, 27, blk); px(ctx, 42, 27, blk);
  px(ctx, 21, 28, blk); px(ctx, 42, 28, blk);

  // crown shadow on slime where it rests
  for (let x = 23; x <= 41; x++) px(ctx, x, 30, grnD);
  for (let x = 24; x <= 40; x++) px(ctx, x, 31, grnD);
}

// ============================================================
// 4) FROSTFORGED — yeti-toned icy golem in a frozen block
// ============================================================
function drawIceGolem(ctx) {
  // pale slate gray body (matches yeti reference)
  const fur = '#c8cdd2', furD = '#94a0aa', furDD = '#5c6770';
  const furL = '#e2e8ec', furH = '#f6fafd';
  // teal/steel-blue accents (shoulder pads, fists, X)
  const acc = '#5a92b0', accD = '#2d5c75', accH = '#8ec1da';
  // ice-block tint (translucent frame)
  const ice = 'rgba(160,210,228,0.22)';
  const iceEdge = '#bee4f0';
  const iceEdgeD = '#5b94ac';
  const blk = '#0a1620';

  // --- Ice block backdrop (transparent cyan slab) ---
  for (let y = 12; y <= 60; y++) {
    for (let x = 6; x <= 58; x++) {
      px(ctx, x, y, ice);
    }
  }
  // ice block outline (with a slight bevel)
  for (let x = 6; x <= 58; x++) { px(ctx, x, 12, iceEdgeD); px(ctx, x, 60, iceEdgeD); }
  for (let y = 12; y <= 60; y++) { px(ctx, 6, y, iceEdgeD); px(ctx, 58, y, iceEdgeD); }
  for (let x = 7; x <= 57; x++) { px(ctx, x, 13, iceEdge); }
  for (let y = 13; y <= 59; y++) { px(ctx, 7, y, iceEdge); }
  // ice block highlight band
  for (let i = 0; i < 14; i++) {
    px(ctx, 9 + i, 14 + i, 'rgba(255,255,255,0.22)');
  }

  floorShadow(ctx);

  // --- LEFT SHOULDER PAD (teal/blue accent, wider than body) ---
  // outer outline
  rect(ctx, 9, 24, 12, 7, blk);
  rect(ctx, 9, 24, 12, 6, accD);
  rect(ctx, 10, 25, 10, 5, acc);
  rect(ctx, 10, 25, 10, 2, accH);
  // top spike bump
  rect(ctx, 11, 22, 3, 2, accD);
  rect(ctx, 17, 22, 3, 2, accD);
  rect(ctx, 11, 22, 3, 1, acc);
  rect(ctx, 17, 22, 3, 1, acc);

  // --- RIGHT SHOULDER PAD ---
  rect(ctx, 43, 24, 12, 7, blk);
  rect(ctx, 43, 24, 12, 6, accD);
  rect(ctx, 44, 25, 10, 5, acc);
  rect(ctx, 44, 25, 10, 2, accH);
  rect(ctx, 44, 22, 3, 2, accD); rect(ctx, 44, 22, 3, 1, acc);
  rect(ctx, 50, 22, 3, 2, accD); rect(ctx, 50, 22, 3, 1, acc);

  // --- HEAD (pale gray block-ish, sunk between shoulders) ---
  rect(ctx, 23, 17, 18, 12, blk);
  rect(ctx, 24, 18, 16, 10, furD);
  rect(ctx, 24, 18, 16, 6, fur);
  rect(ctx, 24, 18, 16, 2, furL);
  rect(ctx, 25, 19, 14, 1, furH);
  rect(ctx, 24, 18, 2, 9, furL);
  // little ear nubs
  px(ctx, 23, 18, accD); px(ctx, 23, 19, accD);
  px(ctx, 41, 18, accD); px(ctx, 41, 19, accD);
  // eyes — narrow dark slits
  rect(ctx, 27, 22, 4, 2, blk);
  rect(ctx, 33, 22, 4, 2, blk);
  // brow shadow over eyes
  rect(ctx, 27, 21, 4, 1, furDD);
  rect(ctx, 33, 21, 4, 1, furDD);
  // mouth/snarl
  rect(ctx, 29, 26, 6, 1, furDD);
  px(ctx, 30, 27, blk); px(ctx, 32, 27, blk); px(ctx, 34, 27, blk);

  // --- ARMS hanging below shoulders ---
  // left arm
  rect(ctx, 10, 30, 10, 12, blk);
  rect(ctx, 11, 30, 8, 11, furD);
  rect(ctx, 11, 30, 8, 6, fur);
  rect(ctx, 12, 31, 6, 1, furL);
  rect(ctx, 11, 30, 2, 11, furL);
  // teal cuff
  rect(ctx, 10, 41, 10, 3, accD);
  rect(ctx, 11, 41, 8, 2, acc);
  rect(ctx, 11, 41, 8, 1, accH);
  // left fist (teal block mitten)
  rect(ctx, 9, 44, 12, 8, blk);
  rect(ctx, 10, 44, 10, 7, accD);
  rect(ctx, 11, 45, 8, 5, acc);
  rect(ctx, 11, 45, 8, 2, accH);

  // right arm (mirror)
  rect(ctx, 44, 30, 10, 12, blk);
  rect(ctx, 45, 30, 8, 11, furD);
  rect(ctx, 45, 30, 8, 6, fur);
  rect(ctx, 46, 31, 6, 1, furL);
  rect(ctx, 45, 30, 2, 11, furL);
  rect(ctx, 44, 41, 10, 3, accD);
  rect(ctx, 45, 41, 8, 2, acc);
  rect(ctx, 45, 41, 8, 1, accH);
  rect(ctx, 43, 44, 12, 8, blk);
  rect(ctx, 44, 44, 10, 7, accD);
  rect(ctx, 45, 45, 8, 5, acc);
  rect(ctx, 45, 45, 8, 2, accH);

  // --- TORSO (pale gray) ---
  rect(ctx, 21, 30, 22, 22, blk);
  rect(ctx, 22, 30, 20, 21, furD);
  rect(ctx, 22, 30, 20, 13, fur);
  rect(ctx, 23, 31, 18, 2, furL);
  rect(ctx, 22, 30, 2, 18, furL);

  // teal chest panel with X
  rect(ctx, 26, 35, 12, 12, accD);
  rect(ctx, 27, 36, 10, 10, acc);
  rect(ctx, 27, 36, 10, 2, accH);
  // X on chest (dark blue)
  for (let i = 0; i < 7; i++) {
    px(ctx, 28+i, 38+i, accD);
    px(ctx, 35-i+1, 38+i, accD);
  }
  // legs hint (bottom of torso)
  rect(ctx, 24, 52, 6, 4, accD);
  rect(ctx, 24, 52, 6, 3, acc);
  rect(ctx, 25, 53, 4, 1, accH);
  rect(ctx, 34, 52, 6, 4, accD);
  rect(ctx, 34, 52, 6, 3, acc);
  rect(ctx, 35, 53, 4, 1, accH);

  // ice highlight glint on block (front)
  rect(ctx, 50, 16, 2, 6, '#e8f4fa');
  px(ctx, 52, 14, '#e8f4fa'); px(ctx, 49, 22, '#e8f4fa');
}

// ============================================================
// 5) CRIMSON WYRM — quadruped red dragon, wings tucked
// ============================================================
// ============================================================
// 5) CRIMSON WYRM — clean side-profile dragon, iconic silhouette
// ============================================================
function drawDragon(ctx) {
  const red = '#c63838', redD = '#7e1a1c', redDD = '#3a0a0e';
  const redL = '#e85a40', redH = '#ff8855';
  const yel = '#f2c63a', yelD = '#a07e1a', yelH = '#ffe890';
  const wing = '#5a121e', wingD = '#28060f', wingDD = '#140309';
  const blk = '#08020a', wht = '#fff0d0';

  floorShadow(ctx);

  // ============ TAIL (curls out behind, with arrow spade tip) ============
  // Single continuous tail with shading. From body rear (x=42) curving right & down
  // Tail centerline points
  const tailPts = [[42, 40], [47, 38], [52, 36], [56, 38], [56, 42]];
  // Draw tail as a thick stroke (3 layers: shadow, mid, light)
  for (let i = 0; i < tailPts.length - 1; i++) {
    const [x0, y0] = tailPts[i], [x1, y1] = tailPts[i+1];
    // outline (thick dark)
    line(ctx, x0, y0 - 2, x1, y1 - 2, redDD);
    line(ctx, x0, y0 + 2, x1, y1 + 2, redDD);
    line(ctx, x0 - 1, y0, x1 - 1, y1, redDD);
    line(ctx, x0 + 1, y0, x1 + 1, y1, redDD);
    // mid red
    line(ctx, x0, y0 - 1, x1, y1 - 1, redD);
    line(ctx, x0, y0, x1, y1, red);
    line(ctx, x0, y0 + 1, x1, y1 + 1, redD);
    // top highlight
    line(ctx, x0, y0 - 1, x1, y1 - 1, redL);
  }
  // tail spade (arrowhead at tip)
  rect(ctx, 54, 41, 5, 5, redDD);
  rect(ctx, 55, 42, 4, 3, redD);
  rect(ctx, 55, 42, 3, 2, red);
  px(ctx, 59, 43, redDD); px(ctx, 59, 44, redDD);
  px(ctx, 55, 46, redDD); px(ctx, 56, 47, redDD);
  // upper point of spade
  px(ctx, 56, 40, redDD);

  // ============ WINGS (folded bat-wing rooted INTO the body shoulder) ============
  // Root at body shoulder (~x=24, y=34) — wing arches up & back, then
  // returns into the body so it visibly attaches.
  // Outline (dark)
  ctx.fillStyle = wingDD;
  ctx.beginPath();
  ctx.moveTo(24, 35);          // shoulder root (inside body)
  ctx.lineTo(22, 26);          // shoulder up
  ctx.lineTo(26, 14);          // wing peak claw
  ctx.lineTo(34, 16);          // arch across back
  ctx.lineTo(42, 18);          // second peak
  ctx.lineTo(44, 26);
  ctx.lineTo(42, 35);          // back into body
  ctx.closePath();
  ctx.fill();
  // mid layer
  ctx.fillStyle = wingD;
  ctx.beginPath();
  ctx.moveTo(25, 34);
  ctx.lineTo(24, 27);
  ctx.lineTo(27, 17);
  ctx.lineTo(34, 18);
  ctx.lineTo(41, 20);
  ctx.lineTo(43, 27);
  ctx.lineTo(41, 34);
  ctx.closePath();
  ctx.fill();
  // inner highlight (lighter wine)
  ctx.fillStyle = wing;
  ctx.beginPath();
  ctx.moveTo(26, 33);
  ctx.lineTo(26, 27);
  ctx.lineTo(29, 21);
  ctx.lineTo(36, 22);
  ctx.lineTo(40, 26);
  ctx.lineTo(39, 33);
  ctx.closePath();
  ctx.fill();
  // wing ribs radiating from shoulder root
  line(ctx, 25, 34, 26, 15, wingDD);
  line(ctx, 25, 34, 34, 17, wingDD);
  line(ctx, 25, 34, 42, 19, wingDD);
  line(ctx, 25, 34, 44, 27, wingDD);
  // wing claws at peaks
  px(ctx, 26, 14, blk); px(ctx, 25, 14, blk); px(ctx, 26, 13, blk);
  px(ctx, 42, 18, blk); px(ctx, 43, 17, blk);
  // shoulder root highlight (where wing meets body)
  px(ctx, 24, 33, redL); px(ctx, 25, 32, redL);

  // ============ BODY (chunky oval) ============
  ellipse(ctx, 32, 38, 13, 8, redDD);
  ellipse(ctx, 32, 38, 12, 7, redD);
  ellipse(ctx, 32, 37, 11, 6, red);
  ellipse(ctx, 28, 34, 6, 2, redL);
  px(ctx, 25, 33, redH);

  // back-spike ridge (small triangle spines along upper back)
  px(ctx, 22, 30, redDD);
  px(ctx, 26, 28, redDD); px(ctx, 26, 29, redD);
  px(ctx, 34, 28, redDD); px(ctx, 34, 29, redD);
  px(ctx, 42, 30, redDD);

  // ============ YELLOW BELLY (long horizontal stripe under body) ============
  ellipse(ctx, 32, 42, 9, 3, yelD);
  ellipse(ctx, 32, 42, 8, 2, yel);
  ellipse(ctx, 30, 41, 5, 1, yelH);
  // belly scale segments
  line(ctx, 26, 42, 38, 42, yelD);
  line(ctx, 27, 43, 37, 43, yelD);

  // ============ NECK (curved flow from body shoulder into back of head) ============
  // tapered curve, wider at body end, narrower toward head.
  // Each row is a horizontal slab; widths chosen to draw an arching neck.
  // Goes from (~x=20, y=36) up-left to (~x=18, y=28) where it meets the head.
  const neckPts = [
    // [y, leftX, rightX, color]
    [36, 19, 26, redDD],
    [35, 18, 25, redD],
    [34, 18, 24, red],
    [33, 17, 23, red],
    [32, 16, 22, red],
    [31, 16, 22, redD],
    [30, 16, 21, redD],
    [29, 17, 21, redDD],
  ];
  for (const [y, lx, rx, c] of neckPts) {
    for (let x = lx; x <= rx; x++) px(ctx, x, y, c);
  }
  // upper neck outline (smooth merge with head)
  for (const [y, lx] of [[36,18],[35,17],[34,17],[33,16],[32,15],[31,15],[30,15],[29,16]]) {
    px(ctx, lx, y, redDD);
  }
  // chest yellow patch on lower neck
  px(ctx, 21, 35, yel); px(ctx, 22, 35, yel); px(ctx, 23, 35, yel);
  px(ctx, 22, 36, yel); px(ctx, 23, 36, yelD);
  // neck highlight stripe
  px(ctx, 18, 33, redL); px(ctx, 17, 32, redL); px(ctx, 17, 31, redL);

  // ============ HEAD (rounder, blends with neck) ============
  // skull: bigger rounded ellipse, lower-positioned so neck flows in
  ellipse(ctx, 14, 25, 7, 6, redDD);
  ellipse(ctx, 14, 25, 6, 5, redD);
  ellipse(ctx, 14, 24, 5, 4, red);
  ellipse(ctx, 12, 22, 3, 2, redL);
  px(ctx, 11, 21, redH);

  // snout (extends LEFT, slightly downward) — thicker upper jaw
  rect(ctx, 5, 24, 9, 4, redDD);
  rect(ctx, 6, 24, 8, 3, redD);
  rect(ctx, 6, 24, 8, 2, red);
  // nose/snout highlight
  px(ctx, 6, 24, redL); px(ctx, 7, 24, redL);
  // nostril (front of snout)
  px(ctx, 5, 25, blk);
  px(ctx, 5, 26, redDD);

  // mouth line (separates upper & lower jaw)
  rect(ctx, 5, 27, 9, 1, blk);

  // ============ LOWER JAW (distinct chunk hanging below snout) ============
  rect(ctx, 6, 28, 10, 3, redDD);
  rect(ctx, 7, 28, 9, 2, redD);
  rect(ctx, 7, 28, 9, 1, red);
  // jaw bottom outline
  rect(ctx, 7, 30, 9, 1, blk);
  // jaw highlight
  px(ctx, 8, 28, redL); px(ctx, 9, 28, redL);
  // teeth jutting DOWN from upper jaw / up from lower jaw
  // upper teeth (point down)
  px(ctx, 6, 28, wht); px(ctx, 8, 28, wht); px(ctx, 10, 28, wht); px(ctx, 12, 28, wht);
  // lower jaw bottom fang
  px(ctx, 14, 30, wht); px(ctx, 11, 30, wht);
  // chin shadow
  px(ctx, 16, 30, redDD); px(ctx, 16, 29, redDD);

  // ============ EYE — large, pronounced, with brow ============
  // socket outline
  rect(ctx, 12, 21, 5, 4, redDD);
  // yellow eye sclera
  rect(ctx, 13, 22, 4, 3, yelH);
  rect(ctx, 13, 22, 4, 2, yel);
  // black pupil (slit)
  rect(ctx, 15, 22, 1, 3, blk);
  // upper eye gleam
  px(ctx, 13, 22, '#ffffff');
  // brow ridge above eye (heavy)
  rect(ctx, 11, 20, 7, 1, redDD);
  rect(ctx, 12, 21, 6, 1, redDD);

  // horns — two pointing back-up from top of head
  px(ctx, 17, 19, redDD); px(ctx, 18, 19, redDD); px(ctx, 18, 20, redDD);
  px(ctx, 19, 18, redDD); px(ctx, 20, 18, redDD); px(ctx, 20, 19, redDD);
  px(ctx, 19, 17, blk); px(ctx, 17, 18, blk);
  // ear-fin
  px(ctx, 16, 22, redDD); px(ctx, 17, 21, redDD);

  // ============ LEGS (4 chunky, near pair in front of far pair) ============
  // front-near leg (left, in foreground)
  rect(ctx, 22, 44, 5, 10, redDD);
  rect(ctx, 23, 45, 3, 9, redD);
  rect(ctx, 23, 45, 2, 7, red);
  // foot + claws
  rect(ctx, 21, 53, 7, 3, redDD);
  rect(ctx, 22, 53, 5, 2, redD);
  px(ctx, 21, 55, blk); px(ctx, 23, 55, blk); px(ctx, 25, 55, blk); px(ctx, 27, 55, blk);
  // front-far leg (slightly back, partially occluded)
  rect(ctx, 28, 45, 4, 9, redDD);
  rect(ctx, 29, 46, 2, 8, redD);
  rect(ctx, 29, 46, 2, 6, red);
  rect(ctx, 27, 53, 6, 2, redDD);
  px(ctx, 28, 54, blk); px(ctx, 30, 54, blk); px(ctx, 32, 54, blk);

  // back-near leg (haunched, with knee bump)
  rect(ctx, 36, 42, 6, 12, redDD);
  rect(ctx, 37, 43, 4, 11, redD);
  rect(ctx, 37, 43, 4, 8, red);
  ellipse(ctx, 38, 43, 3, 2, redL); // haunch highlight
  // foot
  rect(ctx, 35, 53, 8, 3, redDD);
  rect(ctx, 36, 53, 6, 2, redD);
  px(ctx, 35, 55, blk); px(ctx, 37, 55, blk); px(ctx, 39, 55, blk); px(ctx, 41, 55, blk);
  // back-far leg
  rect(ctx, 42, 44, 4, 9, redDD);
  rect(ctx, 43, 45, 2, 8, redD);
  rect(ctx, 43, 45, 2, 6, red);
  rect(ctx, 41, 53, 6, 2, redDD);
  px(ctx, 42, 54, blk); px(ctx, 44, 54, blk); px(ctx, 46, 54, blk);
}

// ============================================================
// 6) BONEWALKER — skeleton with raised arm
// ============================================================
function drawSkeleton(ctx) {
  const bone = '#e8d8a8', boneD = '#a89668', boneDD = '#5e4e28';
  const boneH = '#fff5d0';
  const eye = '#fff04a', eyeH = '#ffffff';
  const blk = '#0a0a06';

  floorShadow(ctx);

  // --- Skull ---
  ellipse(ctx, 32, 14, 9, 8, boneDD);
  ellipse(ctx, 32, 14, 8, 7, boneD);
  ellipse(ctx, 32, 13, 7, 6, bone);
  ellipse(ctx, 30, 12, 4, 3, boneH);
  // jaw
  rect(ctx, 27, 19, 10, 4, boneDD);
  rect(ctx, 28, 20, 8, 3, boneD);
  rect(ctx, 28, 20, 8, 2, bone);
  // teeth
  for (let i = 0; i < 4; i++) {
    px(ctx, 29 + i*2, 22, boneDD);
    rect(ctx, 28 + i*2, 22, 1, 1, bone);
  }
  // eye sockets
  rect(ctx, 27, 12, 4, 4, blk);
  rect(ctx, 33, 12, 4, 4, blk);
  // glowing eyes inside sockets
  rect(ctx, 28, 13, 2, 2, eye);
  rect(ctx, 34, 13, 2, 2, eye);
  px(ctx, 28, 13, eyeH); px(ctx, 34, 13, eyeH);
  // nose hole
  rect(ctx, 31, 16, 2, 3, blk);
  // cracks
  line(ctx, 30, 8, 32, 11, boneDD);
  px(ctx, 35, 10, boneDD);

  // --- Spine ---
  for (let y = 24; y <= 40; y++) {
    if (y % 2 === 0) {
      rect(ctx, 30, y, 4, 1, boneD);
      rect(ctx, 31, y, 2, 1, bone);
    } else {
      px(ctx, 31, y, boneDD); px(ctx, 32, y, boneDD);
    }
  }

  // --- Ribs ---
  const ribY = [26, 29, 32, 35, 38];
  for (const ry of ribY) {
    // left rib
    line(ctx, 28, ry, 22, ry+1, boneDD);
    line(ctx, 28, ry-1, 22, ry, bone);
    // right rib
    line(ctx, 36, ry, 42, ry+1, boneDD);
    line(ctx, 36, ry-1, 42, ry, bone);
  }
  // sternum
  rect(ctx, 31, 25, 2, 14, boneD);
  rect(ctx, 31, 25, 1, 14, bone);

  // --- Raised right arm (player's left when facing forward; up & out) ---
  // shoulder
  disc(ctx, 22, 25, 3, boneDD);
  disc(ctx, 22, 25, 2, boneD);
  px(ctx, 21, 24, bone);
  // upper arm angles up & out
  line(ctx, 22, 25, 14, 18, boneDD);
  line(ctx, 22, 24, 14, 17, boneD);
  line(ctx, 22, 23, 14, 16, bone);
  // elbow
  disc(ctx, 14, 17, 2, boneDD);
  px(ctx, 13, 17, boneD); px(ctx, 14, 17, bone);
  // forearm going up
  rect(ctx, 12, 8, 3, 10, boneDD);
  rect(ctx, 13, 9, 1, 8, boneD);
  // hand (open)
  disc(ctx, 13, 7, 2, boneDD);
  px(ctx, 13, 7, bone);
  // fingers up
  px(ctx, 11, 5, boneDD); px(ctx, 11, 6, bone);
  px(ctx, 13, 4, boneDD); px(ctx, 13, 5, bone);
  px(ctx, 15, 5, boneDD); px(ctx, 15, 6, bone);

  // --- Left arm hanging down ---
  disc(ctx, 42, 25, 3, boneDD);
  disc(ctx, 42, 25, 2, boneD);
  rect(ctx, 41, 27, 3, 12, boneDD);
  rect(ctx, 42, 28, 1, 11, boneD);
  // elbow
  disc(ctx, 42, 39, 2, boneDD);
  rect(ctx, 41, 41, 3, 8, boneDD);
  rect(ctx, 42, 42, 1, 7, boneD);
  // hand
  disc(ctx, 42, 50, 2, boneDD);
  px(ctx, 42, 50, bone);

  // --- Pelvis ---
  rect(ctx, 26, 40, 12, 4, boneDD);
  rect(ctx, 27, 41, 10, 3, boneD);
  rect(ctx, 27, 41, 10, 2, bone);
  // pelvis hole
  px(ctx, 31, 42, blk); px(ctx, 32, 42, blk);

  // --- Legs ---
  // left leg
  rect(ctx, 27, 44, 3, 10, boneDD);
  rect(ctx, 28, 45, 1, 9, boneD);
  disc(ctx, 28, 54, 2, boneDD);
  // foot
  rect(ctx, 25, 55, 5, 2, boneDD);
  rect(ctx, 25, 55, 5, 1, boneD);
  // right leg
  rect(ctx, 34, 44, 3, 10, boneDD);
  rect(ctx, 35, 45, 1, 9, boneD);
  disc(ctx, 35, 54, 2, boneDD);
  rect(ctx, 34, 55, 5, 2, boneDD);
  rect(ctx, 34, 55, 5, 1, boneD);
}

// ============================================================
// 7) WIDOW QUEEN — two-segment spider on a web
// ============================================================
function drawSpider(ctx) {
  const blk = '#0a0a12', dk = '#1a1a26', dk2 = '#262636';
  const leg = '#2a2a3c', legH = '#42425a';
  const red = '#d82828', redD = '#7a1010', redH = '#ff8080';
  const web = 'rgba(220,225,238,0.55)';
  const webD = 'rgba(220,225,238,0.32)';

  // --- WEB at bottom (circular) ---
  // radial strands
  for (let a = 0; a < 12; a++) {
    const ang = (a/12) * Math.PI * 2 - Math.PI/2;
    const x = 32 + Math.round(Math.cos(ang) * 30);
    const y = 50 + Math.round(Math.sin(ang) * 14);
    line(ctx, 32, 50, x, y, webD);
  }
  // concentric arcs (only bottom half)
  for (const r of [5, 10, 15, 20]) {
    for (let a = 0; a < 360; a += 3) {
      const ang = a * Math.PI / 180;
      const x = 32 + Math.round(Math.cos(ang) * r);
      const y = 50 + Math.round(Math.sin(ang) * (r * 0.5));
      if (y >= 50 && y < 64 && x >= 0 && x < 64) px(ctx, x, y, web);
    }
  }

  floorShadow(ctx);

  // --- LEGS (8 — drawn before body so body sits on top) ---
  // Each leg has two segments: a "knee up" then a downward foot
  // Symmetric pairs going outward
  const legs = [
    // upper pair (sweep up)
    [22, 30,  10, 18,   4, 26],   // L1 — far upper-left
    [42, 30,  54, 18,  60, 26],   // R1 — far upper-right
    // upper-mid
    [22, 32,   8, 26,   2, 36],
    [42, 32,  56, 26,  62, 36],
    // lower-mid
    [24, 36,   8, 38,   2, 50],
    [40, 36,  56, 38,  62, 50],
    // lower
    [26, 40,  10, 50,   6, 60],
    [38, 40,  54, 50,  58, 60],
  ];
  for (const [sx, sy, kx, ky, tx, ty] of legs) {
    // shadow stroke (thicker, behind)
    line(ctx, sx, sy + 1, kx, ky + 1, blk);
    line(ctx, kx, ky + 1, tx, ty + 1, blk);
    // main stroke
    line(ctx, sx, sy, kx, ky, leg);
    line(ctx, kx, ky, tx, ty, leg);
    // joint highlight
    px(ctx, kx, ky, legH);
    px(ctx, kx-1, ky-1, legH);
    // foot tip
    px(ctx, tx, ty, blk);
  }

  // --- ABDOMEN (large back segment) ---
  ellipse(ctx, 36, 38, 14, 11, blk);
  ellipse(ctx, 36, 38, 13, 10, dk);
  ellipse(ctx, 36, 37, 12, 9, dk2);
  ellipse(ctx, 32, 34, 6, 3, '#3c3c52'); // top highlight
  // hourglass marking on the back
  rect(ctx, 33, 36, 6, 1, red);
  rect(ctx, 34, 37, 4, 1, red);
  rect(ctx, 35, 38, 2, 2, red);
  rect(ctx, 34, 40, 4, 1, red);
  rect(ctx, 33, 41, 6, 1, red);
  // hourglass shadow
  px(ctx, 35, 37, redD); px(ctx, 37, 37, redD);
  px(ctx, 35, 41, redD); px(ctx, 37, 41, redD);
  // glint on hourglass
  px(ctx, 34, 36, redH); px(ctx, 35, 39, redH);

  // --- CEPHALOTHORAX (front body — bigger, more separated, crisp shape) ---
  // dome shape, lower-front of abdomen
  ellipse(ctx, 22, 36, 9, 7, blk);
  ellipse(ctx, 22, 36, 8, 6, dk);
  ellipse(ctx, 22, 35, 7, 5, dk2);
  // top dome highlight
  ellipse(ctx, 19, 33, 4, 2, '#4a4a62');
  px(ctx, 17, 32, '#5a5a72');

  // --- EYE CLUSTER (8 red eyes — clear grid pattern) ---
  // Top row (4 medium-large)
  rect(ctx, 17, 33, 2, 2, red);
  rect(ctx, 20, 33, 2, 2, red);
  rect(ctx, 23, 33, 2, 2, red);
  rect(ctx, 26, 33, 2, 2, red);
  // tiny highlight in each
  px(ctx, 17, 33, redH);
  px(ctx, 20, 33, redH);
  px(ctx, 23, 33, redH);
  px(ctx, 26, 33, redH);
  // Bottom row (4 smaller flanking)
  px(ctx, 18, 36, red); px(ctx, 19, 36, red);
  px(ctx, 21, 36, red); px(ctx, 22, 36, red);
  px(ctx, 24, 36, red); px(ctx, 25, 36, red);
  px(ctx, 27, 36, red); px(ctx, 28, 36, red);
  // eye outline glow (subtle red haze around cluster)
  for (const x of [16, 19, 22, 25, 28]) {
    px(ctx, x, 32, redD);
  }

  // --- FANGS / CHELICERAE (under head, clearly visible) ---
  // left fang
  rect(ctx, 18, 39, 2, 4, blk);
  rect(ctx, 18, 39, 2, 3, dk);
  px(ctx, 19, 42, '#e8e8f4'); // tip
  // right fang
  rect(ctx, 25, 39, 2, 4, blk);
  rect(ctx, 25, 39, 2, 3, dk);
  px(ctx, 25, 42, '#e8e8f4');
  // jaw underline
  rect(ctx, 18, 39, 9, 1, blk);

  // --- PEDIPALPS (small feelers) ---
  line(ctx, 15, 38, 11, 42, blk);
  line(ctx, 15, 38, 11, 42, leg);
  px(ctx, 11, 42, dk);
  line(ctx, 29, 38, 33, 42, blk);
  line(ctx, 29, 38, 33, 42, leg);
  px(ctx, 33, 42, dk);
}

// ============================================================
// 8) BUBBLED MAGE — big pointed hat, white beard, inside an orb
// ============================================================
function drawWizard(ctx) {
  const hat = '#5a6470', hatD = '#2c333d', hatDD = '#101418';
  const hatH = '#7c8693';
  const robe = '#dadee4', robeD = '#9aa0aa', robeDD = '#5e6470';
  const robeH = '#f0f3f7';
  const skin = '#eed6a8', skinD = '#a87a40';
  const beard = '#f4f5f8', beardD = '#a8aab2';
  const bubbleFill = 'rgba(120,210,240,0.16)';
  const bubbleEdge = '#86dcff';
  const bubbleEdgeD = '#3675a0';
  const bubbleEdgeDD = '#1c4a6a';
  const eye = '#f4c038', eyeH = '#fff4a8';
  const blk = '#080a14';

  floorShadow(ctx);

  // --- BUBBLE (circular, slightly taller than wide) ---
  const bcx = 32, bcy = 36, brx = 22, bry = 24;
  for (let y = bcy - bry; y <= bcy + bry; y++) {
    for (let x = bcx - brx; x <= bcx + brx; x++) {
      const dx = (x - bcx) / brx;
      const dy = (y - bcy) / bry;
      if (dx*dx + dy*dy <= 1) px(ctx, x, y, bubbleFill);
    }
  }

  // --- HAT (huge wide triangular pointed wizard hat) ---
  // The hat dominates the upper half. Tip is high, brim flares wide.
  // Hat tip starts at y=6
  // Build hat as triangle from (32, 6) widening down to brim at y=24
  for (let y = 6; y <= 23; y++) {
    const wHalf = Math.floor((y - 4) * 0.9);  // widening
    // outline
    px(ctx, 32 - wHalf - 1, y, hatDD);
    px(ctx, 32 + wHalf + 1, y, hatDD);
    // fill
    for (let dx = -wHalf; dx <= wHalf; dx++) px(ctx, 32 + dx, y, hat);
    // left highlight stripe
    px(ctx, 32 - wHalf, y, hatD);
    px(ctx, 32 - wHalf + 1, y, hatH);
    // right shadow
    px(ctx, 32 + wHalf, y, hatD);
  }
  // hat bend (slightly curl/droop at top — give it character)
  // Just add a kink at y=8
  px(ctx, 31, 5, hatDD); px(ctx, 32, 5, hatD); px(ctx, 33, 5, hatDD);
  px(ctx, 32, 4, hatDD);

  // hat brim (wide flared rim)
  rect(ctx, 13, 24, 38, 4, hatDD);
  rect(ctx, 14, 24, 36, 3, hatD);
  rect(ctx, 14, 24, 36, 2, hat);
  rect(ctx, 15, 25, 34, 1, hatH);
  rect(ctx, 14, 27, 36, 1, hatDD);
  // brim under-shadow
  rect(ctx, 16, 28, 32, 1, hatDD);
  // gold band around bottom of hat cone (just above brim)
  rect(ctx, 23, 23, 18, 1, '#f0c038');

  // small stars/decoration on hat (tiny)
  px(ctx, 27, 17, '#f0c038');
  px(ctx, 36, 14, '#f0c038');
  px(ctx, 32, 10, '#f0c038');

  // --- BEARD / FACE (under brim) ---
  // beard is the main face element - a big rounded white tuft
  ellipse(ctx, 32, 34, 9, 6, robeDD);
  ellipse(ctx, 32, 34, 8, 5, beardD);
  ellipse(ctx, 32, 33, 7, 4, beard);
  // beard tip taper
  rect(ctx, 29, 38, 7, 4, beardD);
  rect(ctx, 30, 38, 5, 4, beard);
  rect(ctx, 31, 42, 3, 1, beardD);
  px(ctx, 32, 43, beardD);
  // sides of beard (cheek poofs)
  px(ctx, 23, 32, beardD); px(ctx, 22, 33, beardD);
  px(ctx, 41, 32, beardD); px(ctx, 42, 33, beardD);
  // moustache (subtle separation)
  rect(ctx, 28, 32, 8, 1, beardD);
  px(ctx, 28, 32, robeDD); px(ctx, 35, 32, robeDD);

  // --- EYES (glowing yellow squares peeking from brim shadow) ---
  // forehead shadow band under brim
  rect(ctx, 26, 29, 12, 2, robeDD);
  // eyes
  rect(ctx, 28, 29, 2, 2, eye);
  rect(ctx, 34, 29, 2, 2, eye);
  px(ctx, 28, 29, eyeH); px(ctx, 34, 29, eyeH);

  // tiny nose hint
  px(ctx, 32, 31, skinD);

  // --- ROBE / BODY (small, mostly under beard) ---
  // shoulders peek out beside beard
  rect(ctx, 22, 38, 5, 8, robeDD);
  rect(ctx, 23, 38, 4, 7, robeD);
  rect(ctx, 23, 38, 4, 4, robe);
  rect(ctx, 23, 38, 2, 7, robeH);
  rect(ctx, 37, 38, 5, 8, robeDD);
  rect(ctx, 37, 38, 4, 7, robeD);
  rect(ctx, 37, 38, 4, 4, robe);
  rect(ctx, 37, 38, 2, 7, robeH);
  // robe lower (wider, flared)
  for (let y = 44; y <= 54; y++) {
    const halfW = 8 + Math.floor((y - 44) * 0.5);
    rect(ctx, 32 - halfW - 1, y, halfW*2 + 2, 1, robeDD);
    rect(ctx, 32 - halfW, y, halfW*2 + 1, 1, robeD);
    rect(ctx, 32 - halfW + 1, y, halfW*2 - 1, 1, robe);
    px(ctx, 32 - halfW + 1, y, robeH);
  }
  // belt (gold)
  rect(ctx, 25, 44, 14, 2, blk);
  rect(ctx, 25, 44, 14, 1, '#f0c038');
  // belt buckle
  rect(ctx, 31, 44, 3, 2, '#f0c038');
  px(ctx, 32, 45, '#a87a18');

  // --- BUBBLE EDGE (ring around everything) ---
  for (let a = 0; a < 360; a++) {
    const rad = a * Math.PI / 180;
    const x = bcx + Math.round(Math.cos(rad) * brx);
    const y = bcy + Math.round(Math.sin(rad) * bry);
    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
      // hat pokes through top — skip pixels covered by hat
      if (y < 24 && Math.abs(x - 32) < (y - 4) * 0.9 + 2) continue;
      px(ctx, x, y, bubbleEdgeD);
    }
  }
  // inner edge ring
  for (let a = 0; a < 360; a += 2) {
    const rad = a * Math.PI / 180;
    const x = bcx + Math.round(Math.cos(rad) * (brx - 1));
    const y = bcy + Math.round(Math.sin(rad) * (bry - 1));
    if (x >= 0 && x < 64 && y >= 0 && y < 64) {
      if (y < 24 && Math.abs(x - 32) < (y - 4) * 0.9 + 2) continue;
      // alternating glints
      if (a < 60 || (a > 250 && a < 320)) px(ctx, x, y, bubbleEdge);
    }
  }
  // big bubble highlight (top-left)
  rect(ctx, 16, 24, 3, 2, '#ecfaff');
  rect(ctx, 19, 22, 1, 1, '#ecfaff');
  px(ctx, 15, 27, '#bce8ff');
  px(ctx, 17, 28, '#bce8ff');

  // water disc base under bubble
  ellipse(ctx, 32, 58, 18, 2, bubbleEdgeDD);
  ellipse(ctx, 32, 58, 16, 1, bubbleEdgeD);
  ellipse(ctx, 32, 57, 13, 1, bubbleEdge);
}

// ============================================================
// 9) STARGAZER — small gray alien on moon dust
// ============================================================
function drawAlien(ctx) {
  const sk = '#5da08a', skD = '#2c5a4a', skDD = '#102420';
  const skL = '#8ac8a8', skH = '#bce8c8';
  const blk = '#04060a', dark = '#101a18';
  const eyeR = '#5a89c4';
  const moon = '#403d44', moonL = '#5a5560';
  const star = '#fff8d8';

  // background stars
  px(ctx, 6, 6, star); px(ctx, 50, 8, star); px(ctx, 58, 16, star);
  px(ctx, 10, 18, '#aeb5d0'); px(ctx, 4, 30, star);
  // distant planet glint
  disc(ctx, 56, 50, 3, '#8aa0d0');
  disc(ctx, 56, 50, 2, '#b0c8f0');
  px(ctx, 55, 49, '#dde6ff');

  // moon ground at bottom
  for (let y = 54; y <= 63; y++) {
    for (let x = 0; x <= 63; x++) {
      // hill curve
      const hill = 56 - Math.floor(Math.sin((x/63) * Math.PI) * 2);
      if (y >= hill) {
        px(ctx, x, y, y === hill ? moonL : moon);
      }
    }
  }
  // craters
  ring(ctx, 14, 60, 2, moonL);
  ring(ctx, 48, 61, 2, moonL);
  px(ctx, 30, 62, moonL);

  floorShadow(ctx);

  // --- Body (small, slim) ---
  // legs
  rect(ctx, 28, 48, 3, 8, skDD);
  rect(ctx, 29, 49, 1, 6, skD);
  rect(ctx, 33, 48, 3, 8, skDD);
  rect(ctx, 34, 49, 1, 6, skD);
  // feet
  rect(ctx, 26, 55, 5, 2, skDD);
  rect(ctx, 33, 55, 5, 2, skDD);
  px(ctx, 26, 55, skD); px(ctx, 37, 55, skD);

  // torso
  ellipse(ctx, 32, 42, 7, 8, skDD);
  ellipse(ctx, 32, 42, 6, 7, skD);
  ellipse(ctx, 31, 40, 4, 4, sk);
  ellipse(ctx, 30, 39, 2, 2, skL);

  // arms (long, thin, dangling)
  // left
  line(ctx, 25, 38, 22, 46, skDD);
  line(ctx, 26, 38, 23, 46, skD);
  // 3 fingers
  px(ctx, 21, 47, skDD); px(ctx, 22, 48, skDD);
  px(ctx, 23, 48, skDD);
  // right
  line(ctx, 39, 38, 42, 46, skDD);
  line(ctx, 38, 38, 41, 46, skD);
  px(ctx, 42, 47, skDD); px(ctx, 41, 48, skDD);
  px(ctx, 40, 48, skDD);

  // --- Head (big oval, classic gray alien) ---
  ellipse(ctx, 32, 24, 11, 12, skDD);
  ellipse(ctx, 32, 24, 10, 11, skD);
  ellipse(ctx, 32, 23, 9, 10, sk);
  ellipse(ctx, 30, 20, 5, 5, skL);
  ellipse(ctx, 29, 18, 2, 2, skH);

  // neck
  rect(ctx, 30, 34, 4, 2, skDD);
  rect(ctx, 31, 34, 2, 2, skD);

  // big black eye (one big almond on each side)
  // left eye
  ellipse(ctx, 27, 26, 3, 4, blk);
  ellipse(ctx, 27, 26, 2, 3, dark);
  px(ctx, 26, 24, eyeR); px(ctx, 27, 23, '#a0c0f0');
  // right eye
  ellipse(ctx, 37, 26, 3, 4, blk);
  ellipse(ctx, 37, 26, 2, 3, dark);
  px(ctx, 36, 24, eyeR); px(ctx, 37, 23, '#a0c0f0');

  // tiny mouth slit
  rect(ctx, 30, 32, 4, 1, skDD);

  // tiny nose bumps
  px(ctx, 31, 30, skDD); px(ctx, 33, 30, skDD);
}

// ============================================================
// 10) CAVE SLIME — rocky iridescent crystal blob, pink eyes
// ============================================================
function drawCaveSlime(ctx) {
  const grnD = '#1a4a23', grnM = '#3a8a3a', grnL = '#5cc44a', grnH = '#8be068';
  const cyD = '#1a3e58', cyM = '#3a6a8a', cyL = '#5fa0c0', cyH = '#8ed0e0';
  const prD = '#2a0e48', prM = '#5a2080', prL = '#8c4ac0', prH = '#c896e8';
  const blk = '#08040e';
  const pink = '#ff70c0', pinkD = '#a83080', pinkH = '#ffc8e8';
  const wht = '#ffffff';
  const rock = '#6a6878', rockD = '#3e3c4c', rockH = '#9494a8';

  // ---- floor shadow ----
  ellipse(ctx, 32, 60, 26, 3, 'rgba(0,0,0,0.45)');

  // ---- main body silhouette (wide squat blob) ----
  // Determine each pixel by its position relative to a center, with facet zones
  for (let y = 14; y <= 58; y++) {
    for (let x = 3; x <= 61; x++) {
      const dx = (x - 32) / 29;
      const dy = (y - 42) / 24;
      const d = dx*dx + dy*dy;
      if (d > 1) continue;

      // base color zones (top->bottom)
      let c;
      if (y < 26)           c = grnM;            // top
      else if (y < 36)      c = (x < 30 ? grnD : (x < 42 ? grnM : cyM));
      else if (y < 46)      c = (x < 22 ? prD : (x < 36 ? cyM : prM));
      else                  c = (x < 32 ? prM : prD);

      // FACET PATCHES — overlay polygonal color zones (crystalline look)
      // upper-left mid-green dome
      if (y >= 18 && y <= 30 && x >= 14 && x <= 30 && (x - 22)*(x - 22) + (y - 22)*(y - 22) < 60) c = grnL;
      if (y >= 18 && y <= 26 && x >= 18 && x <= 26 && (x - 22)*(x - 22) + (y - 22)*(y - 22) < 20) c = grnH;
      // top-right green->cyan transition
      if (y >= 18 && y <= 30 && x >= 32 && x <= 46 && Math.abs(x + y - 50) < 5) c = grnL;
      // left mid teal panel
      if (y >= 28 && y <= 42 && x >= 6 && x <= 18 && (x - 12)*(x - 12) + (y - 34)*(y - 34) < 50) c = cyL;
      // right mid teal panel
      if (y >= 30 && y <= 44 && x >= 40 && x <= 56 && (x - 48)*(x - 48) + (y - 36)*(y - 36) < 60) c = cyL;
      // center bottom purple highlight
      if (y >= 42 && y <= 54 && x >= 22 && x <= 44 && (x - 32)*(x - 32) + (y - 48)*(y - 48) < 80) c = prL;
      // bottom-left dark purple
      if (y >= 44 && y <= 56 && x >= 4 && x <= 22 && (x - 12)*(x - 12) + (y - 50)*(y - 50) < 80) c = prM;
      // bottom-right cyan-purple shift
      if (y >= 44 && y <= 56 && x >= 42 && x <= 60 && (x - 50)*(x - 50) + (y - 50)*(y - 50) < 80) c = prD;

      // outline (darken edge)
      if (d > 0.93) c = blk;
      else if (d > 0.86) {
        // edge shadow shifted toward darker variant of that zone
        if (y < 30) c = grnD;
        else if (y < 44) c = cyD;
        else c = prD;
      }

      px(ctx, x, y, c);
    }
  }

  // ---- highlight glints (crystalline shine) ----
  rect(ctx, 22, 19, 4, 2, grnH);
  px(ctx, 26, 18, grnH);
  rect(ctx, 47, 36, 3, 2, cyH);
  px(ctx, 50, 35, cyH);
  rect(ctx, 28, 46, 4, 2, prH);
  px(ctx, 32, 45, prH);
  // tiny sparkles
  px(ctx, 20, 25, wht); px(ctx, 44, 28, wht); px(ctx, 36, 50, wht);

  // ---- FACET EDGE LINES (give it that low-poly crystal feel) ----
  // top edge between green zones
  line(ctx, 18, 22, 28, 16, grnD);
  line(ctx, 28, 16, 38, 20, grnD);
  // mid horizon line between green and teal
  line(ctx, 8, 30, 24, 28, cyD);
  line(ctx, 38, 28, 56, 32, cyD);
  // diagonal purple facet edges (lower)
  line(ctx, 12, 44, 26, 50, prD);
  line(ctx, 26, 50, 40, 48, prD);
  line(ctx, 40, 48, 54, 52, prD);

  // ---- HUGE PINK GLOWING EYES ----
  // halo glow (subtle outer ring)
  for (let y = -7; y <= 7; y++) {
    for (let x = -7; x <= 7; x++) {
      const d = x*x + y*y;
      if (d <= 49 && d >= 36) {
        // left eye halo
        const lx = 23 + x, ly = 30 + y;
        if (lx >= 0 && lx < 64 && ly >= 0 && ly < 64) {
          // additive-ish pink overlay (only on body)
          const dx = (lx - 32) / 29, dy = (ly - 42) / 24;
          if (dx*dx + dy*dy <= 1) px(ctx, lx, ly, 'rgba(255,120,200,0.35)');
        }
        const rx = 41 + x, ry = 30 + y;
        if (rx >= 0 && rx < 64 && ry >= 0 && ry < 64) {
          const dx = (rx - 32) / 29, dy = (ry - 42) / 24;
          if (dx*dx + dy*dy <= 1) px(ctx, rx, ry, 'rgba(255,120,200,0.35)');
        }
      }
    }
  }

  // left eye (big pink with white center)
  disc(ctx, 23, 30, 6, blk);
  disc(ctx, 23, 30, 5, pinkD);
  disc(ctx, 23, 30, 4, pink);
  disc(ctx, 23, 30, 3, pinkH);
  disc(ctx, 22, 29, 2, wht);
  // tiny dark pupil
  px(ctx, 24, 31, blk);

  // right eye
  disc(ctx, 41, 30, 6, blk);
  disc(ctx, 41, 30, 5, pinkD);
  disc(ctx, 41, 30, 4, pink);
  disc(ctx, 41, 30, 3, pinkH);
  disc(ctx, 40, 29, 2, wht);
  px(ctx, 42, 31, blk);

  // ---- small slit mouth between eyes (low) ----
  rect(ctx, 30, 39, 5, 1, blk);
  px(ctx, 30, 40, blk); px(ctx, 34, 40, blk);

  // ---- small cave rocks at base ----
  // left rock
  ellipse(ctx, 6, 58, 5, 2, rockD);
  ellipse(ctx, 6, 57, 4, 2, rock);
  px(ctx, 5, 56, rockH);
  // right rock
  ellipse(ctx, 58, 58, 5, 2, rockD);
  ellipse(ctx, 58, 57, 4, 2, rock);
  px(ctx, 57, 56, rockH);
  // mini front rock
  ellipse(ctx, 32, 61, 3, 1, rockD);
  px(ctx, 32, 60, rock);
}

// ============================================================
// SLIMETRICS REGISTRY + RENDER
// ============================================================

// ============================================================
// 11) PLAGUE RAT — hunched toon rat, big ears, curled tail
// ============================================================
function drawRat(ctx) {
  const fur = '#8a8c96', furD = '#5c5e6c', furDD = '#33343f', furL = '#abadb8', furH = '#cdcfd8';
  const pink = '#e89aa8', pinkD = '#b05c72', pinkH = '#f6c4cf';
  const nose = '#d86a86', noseD = '#9a3a54';
  const blk = '#0a0a10', wht = '#fff8f0';
  const tooth = '#fdf0d0', toothD = '#c8b078';

  floorShadow(ctx);

  // ---- curled tail (sweeps out to the right, behind body) ----
  const tail = [[42,48],[50,49],[56,46],[58,40],[55,35],[50,35]];
  for (let i = 0; i < tail.length - 1; i++) {
    const [x0,y0] = tail[i], [x1,y1] = tail[i+1];
    line(ctx, x0, y0, x1, y1, pinkD);
    line(ctx, x0, y0-1, x1, y1-1, pink);
    line(ctx, x0, y0+1, x1, y1+1, pinkD);
  }
  // tail base thicker
  ellipse(ctx, 43, 48, 3, 2, pinkD);
  ellipse(ctx, 43, 48, 2, 1, pink);

  // ---- haunch / back leg (right side) ----
  ellipse(ctx, 41, 48, 8, 7, furDD);
  ellipse(ctx, 41, 48, 7, 6, furD);
  ellipse(ctx, 40, 46, 5, 4, fur);
  ellipse(ctx, 39, 45, 3, 2, furL);
  // foot
  ellipse(ctx, 44, 55, 4, 2, pinkD);
  ellipse(ctx, 44, 55, 3, 1, pink);
  px(ctx, 41, 56, pinkD); px(ctx, 44, 57, pinkD); px(ctx, 47, 56, pinkD);

  // ---- body (hunched oval, leaning forward-left) ----
  ellipse(ctx, 32, 42, 15, 13, furDD);
  ellipse(ctx, 32, 42, 14, 12, furD);
  ellipse(ctx, 30, 40, 11, 9, fur);
  // back highlight
  ellipse(ctx, 27, 35, 6, 4, furL);
  px(ctx, 24, 33, furH);
  // belly (lighter, lower-left)
  ellipse(ctx, 28, 48, 8, 5, furL);
  ellipse(ctx, 27, 49, 6, 3, furH);

  // ---- front leg / paw (reaching down center) ----
  ellipse(ctx, 30, 53, 4, 4, furD);
  ellipse(ctx, 29, 52, 3, 2, fur);
  // paw
  ellipse(ctx, 29, 56, 3, 2, pinkD);
  ellipse(ctx, 29, 56, 2, 1, pink);
  px(ctx, 27, 57, pinkD); px(ctx, 29, 58, pinkD); px(ctx, 31, 57, pinkD);

  // ---- HEAD (pointed snout to the lower-left) ----
  // skull
  ellipse(ctx, 18, 32, 9, 8, furDD);
  ellipse(ctx, 18, 32, 8, 7, furD);
  ellipse(ctx, 17, 31, 6, 5, fur);
  ellipse(ctx, 15, 29, 3, 2, furL);

  // snout taper (points down-left)
  for (let i = 0; i < 8; i++) {
    const x = 12 - i, y = 33 + (i*0.5|0);
    const w = 4 - (i*0.45|0);
    rect(ctx, x - w, y - w, w, w*2, furD);
    rect(ctx, x - w + 1, y - w + 1, w, w, fur);
  }
  // nose tip
  disc(ctx, 5, 36, 2, noseD);
  disc(ctx, 5, 36, 1, nose);
  px(ctx, 4, 35, pinkH);
  // whiskers
  line(ctx, 6, 36, 1, 33, furDD);
  line(ctx, 6, 37, 0, 38, furDD);
  line(ctx, 7, 37, 2, 41, furDD);

  // ---- big round ears ----
  // back ear
  disc(ctx, 24, 22, 6, furDD);
  disc(ctx, 24, 22, 5, furD);
  disc(ctx, 24, 22, 3, pinkD);
  disc(ctx, 24, 22, 2, pink);
  // front ear
  disc(ctx, 15, 23, 6, furDD);
  disc(ctx, 15, 23, 5, fur);
  disc(ctx, 15, 23, 3, pinkD);
  disc(ctx, 15, 23, 2, pink);
  px(ctx, 14, 21, pinkH);

  // ---- eye (beady, on the head) ----
  disc(ctx, 19, 30, 3, blk);
  disc(ctx, 19, 30, 2, '#1a1a22');
  px(ctx, 18, 29, wht);
  // brow furrow (menacing)
  px(ctx, 16, 27, furDD); px(ctx, 17, 27, furDD); px(ctx, 18, 28, furDD);
  px(ctx, 21, 28, furDD); px(ctx, 22, 28, furDD);

  // ---- buck teeth under snout ----
  rect(ctx, 6, 39, 4, 3, toothD);
  rect(ctx, 6, 39, 4, 2, tooth);
  px(ctx, 7, 42, toothD); px(ctx, 8, 42, toothD);
  // gap line between teeth
  px(ctx, 8, 39, noseD); px(ctx, 8, 40, noseD); px(ctx, 8, 41, noseD);

  // ---- claw hint on front paw ----
  px(ctx, 27, 58, wht); px(ctx, 31, 58, wht);
}

// ============================================================
// 12) STINGER DRONE — chunky toon bee, round body, wings
// ============================================================
function drawBee(ctx) {
  const yel = '#f6c82e', yelD = '#c89414', yelDD = '#8a6208', yelH = '#ffe87a';
  const blk = '#1a1410', blkL = '#332a1e';
  const wingC = 'rgba(200,235,255,0.55)', wingE = '#9ad0ec', wingED = '#5a92b0';
  const wht = '#ffffff', eyeB = '#0a0a12';
  const sting = '#3a3340', stingL = '#5c5468';
  const pink = '#ff9ec0';

  floorShadow(ctx);

  // ---- WINGS (behind body, translucent, fluttering up) ----
  // left wing
  ctx.save();
  ctx.fillStyle = wingC;
  ctx.beginPath();
  ctx.ellipse(20, 22, 11, 6, -0.5, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  ellipseOutline(ctx, 20, 22, 10, 6, wingED);
  // right wing
  ctx.save();
  ctx.fillStyle = wingC;
  ctx.beginPath();
  ctx.ellipse(44, 22, 11, 6, 0.5, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  ellipseOutline(ctx, 44, 22, 10, 6, wingED);
  // wing vein hints
  line(ctx, 14, 24, 26, 20, 'rgba(154,208,236,0.6)');
  line(ctx, 38, 20, 50, 24, 'rgba(154,208,236,0.6)');

  // ---- BODY (big round striped abdomen) ----
  ellipse(ctx, 32, 40, 16, 14, blk);
  ellipse(ctx, 32, 40, 15, 13, yelDD);
  // base yellow fill
  for (let y = 28; y <= 53; y++) {
    for (let x = 17; x <= 47; x++) {
      const dx = (x-32)/15, dy = (y-40)/13;
      if (dx*dx+dy*dy <= 1) px(ctx, x, y, yel);
    }
  }
  // black stripes (3 curved bands)
  for (const cx of [33, 40]) {
    for (let y = 28; y <= 53; y++) {
      for (let x = 17; x <= 47; x++) {
        const dx = (x-32)/15, dy = (y-40)/13;
        if (dx*dx+dy*dy <= 1) {
          // diagonal-ish vertical bands
          if (Math.abs(x - cx - (y-40)*0.15) < 2.2) px(ctx, x, y, blk);
        }
      }
    }
  }
  // first thin stripe near head
  for (let y = 28; y <= 53; y++) {
    for (let x = 17; x <= 47; x++) {
      const dx = (x-32)/15, dy = (y-40)/13;
      if (dx*dx+dy*dy <= 1 && Math.abs(x - 26 - (y-40)*0.15) < 1.8) px(ctx, x, y, blk);
    }
  }
  // shading: top highlight + bottom shadow
  for (let y = 28; y <= 53; y++) {
    for (let x = 17; x <= 47; x++) {
      const dx = (x-32)/15, dy = (y-40)/13;
      const d = dx*dx+dy*dy;
      if (d <= 1 && d > 0.82) {
        // edge shadow only on yellow pixels
      }
    }
  }
  // top sheen
  ellipse(ctx, 27, 32, 6, 3, yelH);
  px(ctx, 24, 30, '#fff4b0');
  // belly fuzz line
  ellipse(ctx, 32, 50, 10, 2, yelDD);

  // ---- STINGER (bottom point) ----
  px(ctx, 32, 55, sting);
  px(ctx, 31, 54, sting); px(ctx, 32, 54, stingL); px(ctx, 33, 54, sting);
  px(ctx, 31, 56, sting); px(ctx, 32, 57, sting);

  // ---- HEAD (round, fuzzy, on top-left) ----
  disc(ctx, 24, 22, 9, blk);
  disc(ctx, 24, 22, 8, blkL);
  disc(ctx, 23, 20, 5, '#42382a');
  // fuzzy collar between head and body
  ellipse(ctx, 27, 30, 7, 3, yelD);
  ellipse(ctx, 27, 30, 6, 2, yelH);

  // ---- antennae (with bobbles) ----
  line(ctx, 21, 15, 17, 8, blk);
  line(ctx, 26, 14, 28, 7, blk);
  disc(ctx, 16, 7, 2, blk); disc(ctx, 16, 7, 1, yelH);
  disc(ctx, 29, 6, 2, blk); disc(ctx, 29, 6, 1, yelH);

  // ---- big shiny eyes ----
  disc(ctx, 20, 22, 3, wht);
  disc(ctx, 20, 22, 2, eyeB);
  px(ctx, 19, 21, wht);
  disc(ctx, 28, 21, 3, wht);
  disc(ctx, 28, 21, 2, eyeB);
  px(ctx, 27, 20, wht);

  // ---- cute smile + cheeks ----
  // smile
  px(ctx, 22, 26, '#000'); px(ctx, 23, 27, '#000'); px(ctx, 24, 27, '#000');
  px(ctx, 25, 27, '#000'); px(ctx, 26, 26, '#000');
  // blush cheeks
  px(ctx, 18, 25, pink); px(ctx, 19, 25, pink);
  px(ctx, 29, 24, pink); px(ctx, 30, 24, pink);

  // ---- tiny legs dangling ----
  for (const lx of [26, 32, 38]) {
    line(ctx, lx, 52, lx-1, 57, blk);
    px(ctx, lx-2, 58, blk);
  }
}

// ============================================================
// 13) MARSH FROG — fat toon frog, big eyes, wide grin
// ============================================================
function drawFrog(ctx) {
  const grn = '#5cae3a', grnD = '#357a26', grnDD = '#1a4416', grnL = '#86cf52', grnH = '#b4e878';
  const belly = '#dce89a', bellyD = '#acc066', bellyH = '#f0f6c0';
  const blk = '#0a1408', wht = '#ffffff';
  const spot = '#2e6a1e';
  const mouth = '#7a3a4a', mouthD = '#4a1e2e', tongue = '#e87a90';
  const cheek = '#ff9a86';

  floorShadow(ctx);

  // ---- back feet (splayed out at sides) ----
  // left foot
  ellipse(ctx, 12, 54, 7, 3, grnDD);
  ellipse(ctx, 12, 53, 6, 2, grn);
  // toes
  for (const tx of [6, 10, 14]) { ellipse(ctx, tx, 56, 2, 1, grnD); px(ctx, tx, 56, grnL); }
  // right foot
  ellipse(ctx, 52, 54, 7, 3, grnDD);
  ellipse(ctx, 52, 53, 6, 2, grn);
  for (const tx of [50, 54, 58]) { ellipse(ctx, tx, 56, 2, 1, grnD); px(ctx, tx, 56, grnL); }

  // ---- BODY (fat squat dome) ----
  for (let y = 26; y <= 56; y++) {
    for (let x = 8; x <= 56; x++) {
      const dx = (x-32)/24, dy = (y-46)/22;
      const d = dx*dx + dy*dy;
      if (d > 1) continue;
      let c = grn;
      if (d > 0.9) c = grnDD;
      else if (d > 0.78) c = grnD;
      // back highlight upper-left
      if (y < 38 && x < 32 && d < 0.5) c = grnL;
      px(ctx, x, y, c);
    }
  }
  // belly (big pale patch, lower-center)
  for (let y = 40; y <= 56; y++) {
    for (let x = 18; x <= 46; x++) {
      const dx = (x-32)/13, dy = (y-50)/9;
      const d = dx*dx + dy*dy;
      if (d <= 1) {
        let c = belly;
        if (d > 0.8) c = bellyD;
        px(ctx, x, y, c);
      }
    }
  }
  px(ctx, 26, 46, bellyH); px(ctx, 27, 45, bellyH);

  // back spots
  disc(ctx, 18, 34, 2, spot); disc(ctx, 44, 36, 2, spot);
  disc(ctx, 38, 30, 1, spot); px(ctx, 24, 30, spot);

  // ---- front feet (small, in front of belly) ----
  ellipse(ctx, 22, 56, 4, 2, grnD);
  for (const tx of [19, 22, 25]) px(ctx, tx, 57, grnDD);
  ellipse(ctx, 42, 56, 4, 2, grnD);
  for (const tx of [39, 42, 45]) px(ctx, tx, 57, grnDD);

  // ---- WIDE GRIN (big toon mouth across face) ----
  // mouth line curving up at corners
  for (let x = 16; x <= 48; x++) {
    const t = (x - 32) / 16;
    const y = 38 - Math.round((1 - t*t) * 3) + 3;  // smile curve
    px(ctx, x, y, mouthD);
    px(ctx, x, y+1, mouth);
  }
  // mouth corners turn up
  px(ctx, 15, 37, mouthD); px(ctx, 49, 37, mouthD);
  // little tongue at center bottom of grin
  ellipse(ctx, 32, 42, 4, 1, tongue);

  // ---- big bulging EYES on top of head ----
  // left eye bump
  disc(ctx, 21, 22, 8, grnDD);
  disc(ctx, 21, 22, 7, grn);
  disc(ctx, 21, 21, 5, grnL);
  // eyeball white
  disc(ctx, 21, 21, 4, wht);
  // round black pupil (solid block, rounded corners)
  rect(ctx, 19, 20, 4, 4, blk);
  px(ctx, 19, 20, wht); px(ctx, 22, 20, wht);
  px(ctx, 19, 23, wht); px(ctx, 22, 23, wht);
  px(ctx, 18, 19, wht); // glint

  // right eye bump
  disc(ctx, 43, 22, 8, grnDD);
  disc(ctx, 43, 22, 7, grn);
  disc(ctx, 43, 21, 5, grnL);
  disc(ctx, 43, 21, 4, wht);
  rect(ctx, 41, 20, 4, 4, blk);
  px(ctx, 41, 20, wht); px(ctx, 44, 20, wht);
  px(ctx, 41, 23, wht); px(ctx, 44, 23, wht);
  px(ctx, 40, 19, wht);

  // ---- nostrils ----
  px(ctx, 30, 32, grnDD); px(ctx, 34, 32, grnDD);

  // ---- blush cheeks (below the grin, out to the sides) ----
  ellipse(ctx, 13, 44, 2, 1, cheek);
  ellipse(ctx, 51, 44, 2, 1, cheek);
}

export const BOSS_SPRITES = {
  snake_boss: { label: 'Snake Boss', draw: drawCobra },
  cobra: { label: 'Snake Boss', draw: drawCobra },
  rock_golem: { label: 'Rock Golem', draw: drawGolem },
  golem: { label: 'Rock Golem', draw: drawGolem },
  slime_daddy: { label: 'Slime Daddy', draw: drawSlimeKing },
  slime_king: { label: 'Slime Daddy', draw: drawSlimeKing },
  frost_yeti: { label: 'Frost Yeti', draw: drawIceGolem },
  yeti: { label: 'Frost Yeti', draw: drawIceGolem },
  ice_golem: { label: 'Frost Yeti', draw: drawIceGolem },
  dragon: { label: 'Dragon', draw: drawDragon },
  dragon_boss: { label: 'Dragon', draw: drawDragon },
  skele: { label: 'Skele', draw: drawSkeleton },
  skeleton: { label: 'Skele', draw: drawSkeleton },
  spider: { label: 'Spider', draw: drawSpider },
  spider_boss: { label: 'Spider', draw: drawSpider },
  wizard: { label: 'Wizard', draw: drawWizard },
  wizard_boss: { label: 'Wizard', draw: drawWizard },
  alien: { label: 'Alien', draw: drawAlien },
  alien_boss: { label: 'Alien', draw: drawAlien },
  giant_cave_slime: { label: 'Giant Cave Slime', draw: drawCaveSlime },
  cave_slime: { label: 'Giant Cave Slime', draw: drawCaveSlime },
  rat: { label: 'Rat', draw: drawRat },
  rat_boss: { label: 'Rat', draw: drawRat },
  bee: { label: 'Bee', draw: drawBee },
  bee_boss: { label: 'Bee', draw: drawBee },
  frog: { label: 'Frog', draw: drawFrog },
  frog_boss: { label: 'Frog', draw: drawFrog },
};

const KC_TO_BOSS_KEY = {
  snake_kc: 'snake_boss',
  golem_kc: 'rock_golem',
  slime_daddy_kc: 'slime_daddy',
  cave_slime_kc: 'giant_cave_slime',
  yeti_kc: 'frost_yeti',
  dragon_kc: 'dragon',
  skele_kc: 'skele',
  spider_kc: 'spider',
  wizard_kc: 'wizard',
  alien_kc: 'alien',
  rat_kc: 'rat',
  bee_kc: 'bee',
  frog_kc: 'frog',
};

export function bossKeyForKc(id) {
  return KC_TO_BOSS_KEY[id] || null;
}

export function normalizeBossKey(key) {
  const k = String(key || '').trim();
  if (BOSS_SPRITES[k]) return k;
  return k
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function bossLabel(key) {
  const k = normalizeBossKey(key);
  return BOSS_SPRITES[k]?.label || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function bossSpriteHtml(key, className = '') {
  const k = normalizeBossKey(key);
  const meta = BOSS_SPRITES[k];
  if (!meta) return '<span class="boss-sprite-fallback" aria-hidden="true">👹</span>';
  const cls = className ? ` ${escAttr(className)}` : '';
  const label = escAttr(meta.label);
  return `<span class="boss-sprite-frame${cls}" title="${label}">
    <canvas class="boss-sprite" width="${W}" height="${H}" data-boss-sprite="${escAttr(k)}" aria-label="${label}"></canvas>
  </span>`;
}

export function drawBossSprite(canvas, key) {
  const k = normalizeBossKey(key);
  const meta = BOSS_SPRITES[k];
  if (!meta || !canvas) return false;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return false;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  meta.draw(ctx);
  return true;
}

export function renderBossSprites(root = document) {
  root.querySelectorAll?.('canvas[data-boss-sprite]').forEach(canvas => {
    const key = canvas.dataset.bossSprite;
    if (canvas.dataset.bossSpriteRendered === key) return;
    if (drawBossSprite(canvas, key)) canvas.dataset.bossSpriteRendered = key;
  });
}
