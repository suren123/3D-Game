const wrap = (body, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
export function icon(name) {
  const paths = {
    arrow: '<path d="M13 32h36M35 18l14 14-14 14" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    chevron: '<path d="m26 20 12 12-12 12" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
    close: '<path d="m20 20 24 24m0-24L20 44" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    pause: '<rect x="19" y="15" width="9" height="34" rx="3" fill="currentColor"/><rect x="36" y="15" width="9" height="34" rx="3" fill="currentColor"/>',
    play: '<path d="m24 15 25 17-25 17z" fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>',
    check: '<path d="m17 33 10 10 22-24" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    help: '<circle cx="32" cy="32" r="22" stroke="currentColor" stroke-width="3.5"/><path d="M25 25c0-10 17-9 16 0 0 5-9 5-9 11" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="44" r="2.5" fill="currentColor"/>',
    sound: '<path d="M11 26h10l12-10v32L21 38H11z" fill="currentColor"/><path d="M41 24c5 4 5 12 0 16m7-23c9 7 9 23 0 30" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
    muted: '<path d="M11 26h10l12-10v32L21 38H11z" fill="currentColor"/><path d="m42 26 12 12m0-12L42 38" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>',
    grid: '<rect x="12" y="12" width="16" height="16" rx="4" stroke="currentColor" stroke-width="3"/><rect x="36" y="12" width="16" height="16" rx="4" stroke="currentColor" stroke-width="3"/><rect x="12" y="36" width="16" height="16" rx="4" stroke="currentColor" stroke-width="3"/><rect x="36" y="36" width="16" height="16" rx="4" stroke="currentColor" stroke-width="3"/>',
    heart: '<path d="M32 50 12 31C0 15 21 5 32 22 43 5 64 15 52 31z" fill="currentColor"/>',
    star: '<path d="m32 7 7.5 16 18 2.5-13 13 3 18L32 48l-15.5 8.5 3-18-13-13 18-2.5z" fill="#ffca62" stroke="#e9a947" stroke-width="2" stroke-linejoin="round"/>',
    sun: '<circle cx="32" cy="32" r="13" fill="#f5bd55"/><g stroke="#f5bd55" stroke-width="4" stroke-linecap="round"><path d="M32 7v5m0 40v5M7 32h5m40 0h5M14 14l4 4m28 28 4 4M14 50l4-4m28-28 4-4"/></g><circle cx="28" cy="31" r="1.5" fill="#af7c38"/><circle cx="37" cy="31" r="1.5" fill="#af7c38"/><path d="M28 37q4 4 9 0" stroke="#af7c38" stroke-width="1.5" stroke-linecap="round"/>',
    town: '<path d="m8 29 16-15 16 15v25H8z" fill="currentColor" opacity=".85"/><path d="M37 21h17v33H37z" fill="currentColor" opacity=".5"/><path d="M19 37h10v17H19z" fill="#fbf9ef"/><rect x="41" y="28" width="7" height="7" rx="1" fill="#fbf9ef"/>',
    sticker: '<path d="M13 9h38a5 5 0 0 1 5 5v25L39 56H13a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5Z" stroke="currentColor" stroke-width="3"/><path d="M39 56V44a5 5 0 0 1 5-5h12" stroke="currentColor" stroke-width="3"/><path d="m29 17 4 8 9 1-7 7 2 9-8-5-8 5 2-9-7-7 9-1z" fill="currentColor" opacity=".6"/>',
    car: '<ellipse cx="32" cy="54" rx="26" ry="4" fill="#315b4f" opacity=".12"/><path d="m15 32 7-16h20l9 17" fill="#ef9470"/><path d="m24 20-5 12h24l-5-12" fill="#c5e9e1"/><path d="M32 20v12" stroke="#fff8df" stroke-width="2"/><rect x="7" y="31" width="50" height="19" rx="7" fill="#f6c665"/><path d="M10 42h44" stroke="#e9af4e" stroke-width="2"/><rect x="9" y="35" width="7" height="5" rx="2" fill="#fff8df"/><rect x="49" y="35" width="6" height="5" rx="2" fill="#ef8267"/><circle cx="18" cy="49" r="7" fill="#355853"/><circle cx="46" cy="49" r="7" fill="#355853"/><circle cx="18" cy="49" r="3" fill="#f9f7e9"/><circle cx="46" cy="49" r="3" fill="#f9f7e9"/>',
    bread: '<ellipse cx="32" cy="52" rx="24" ry="5" fill="#c9904b" opacity=".17"/><g transform="rotate(-25 32 32)"><rect x="6" y="16" width="52" height="32" rx="16" fill="#d99045"/><rect x="7" y="14" width="50" height="29" rx="14" fill="#f3bd70"/><path d="m20 19 3 10m9-13 3 11m9-10 3 9" stroke="#fff0c9" stroke-width="5" stroke-linecap="round"/></g>',
    flowers: '<path d="M32 49V27m0 18q-18 0-16-13 14 0 16 13m0-5q16-2 16-12-14 0-16 12" stroke="#559777" stroke-width="3" fill="#8db994"/><path d="m21 47 3 13h17l3-13z" fill="#df9774"/><circle cx="32" cy="13" r="9" fill="#f8d774"/><circle cx="21" cy="23" r="9" fill="#f8d774"/><circle cx="43" cy="23" r="9" fill="#f8d774"/><circle cx="25" cy="34" r="9" fill="#f8d774"/><circle cx="39" cy="34" r="9" fill="#f8d774"/><circle cx="32" cy="25" r="9" fill="#eaa45c"/><circle cx="29" cy="24" r="1.4" fill="#956537"/><circle cx="35" cy="24" r="1.4" fill="#956537"/>',
    wash: '<circle cx="23" cy="37" r="19" fill="#a5dbe4" stroke="#73b8ce" stroke-width="2"/><circle cx="43" cy="22" r="14" fill="#d3ebf0" stroke="#91cad8" stroke-width="2"/><circle cx="48" cy="48" r="9" fill="#b3e2df"/><path d="M12 33q0-8 8-9m16-5q0-5 5-6" stroke="white" stroke-width="4" stroke-linecap="round"/><path d="m13 6 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f3c85b"/>',
    park: '<path d="M29 36h6v24h-6z" fill="#c49363"/><circle cx="32" cy="22" r="17" fill="#6eab83"/><circle cx="19" cy="34" r="13" fill="#84b992"/><circle cx="44" cy="34" r="13" fill="#79af88"/>',
    station: '<path d="m9 24 23-15 23 15" fill="#e8876a"/><rect x="12" y="24" width="40" height="35" rx="3" fill="#f5bb9d"/><rect x="21" y="35" width="22" height="24" rx="4" fill="#83aba1"/><path d="M24 40h16m-16 6h16m-16 6h16" stroke="#f5d3ac" stroke-width="2"/><circle cx="32" cy="22" r="6" fill="#ffedb7"/>',
  };
  return wrap(paths[name] || paths.car);
}
export function missionArt(name) {
  const bg = name === 'bread' ? '#fae9ce' : name === 'flowers' ? '#e5edd9' : '#deeff0';
  return `<div class="art-sky" style="--art-bg:${bg}"><span class="art-spark one">✦</span><span class="art-spark two">✧</span><div class="art-hill"></div><div class="art-cargo">${icon(name)}</div><div class="art-car">${icon('car')}</div><span class="art-puff"></span></div>`;
}
