export function renderFAQ($page) {
  $page.innerHTML = `
    <div class="shell">
      <h1 class="st-page-title">FAQ</h1>
      <div class="st-card">
        <div class="st-card-body" style="line-height:1.65">
          <h2>What is Slimetrics?</h2>
          <p>Public XP tracker for <a href="https://slimeville.online/">Slimeville Online</a>. Snapshots player stats over time so you can see gains, hiscores, and personal records.</p>

          <h2>How are snapshots taken?</h2>
          <p>Lazily — when someone views a player page and the player's last snapshot is older than 3 hours, a new one is captured automatically. You can also force one with the <strong>Update Now</strong> button (60-second throttle).</p>

          <h2>What's a "Sapling"?</h2>
          <p>An account created on or after <strong>March 23, 2026</strong>, when the game was reset. Older accounts are <strong>Legacy</strong>. Hiscores and Records can be filtered by either group.</p>

          <h2>My graphs are empty / only one data point.</h2>
          <p>Slimetrics only stores history from the day you were first tracked. Click <strong>Update Now</strong> a couple of times across some XP gains to see lines fill in.</p>

          <h2>Can I export my data?</h2>
          <p>Not yet — but the underlying RPCs are public and well-documented. Check the API page (coming soon).</p>
        </div>
      </div>
    </div>`;
}
