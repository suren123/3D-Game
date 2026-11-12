export function createAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error('这个浏览器暂时不能播放小镇声音，请更新 Safari 后再试。');
  const context = new Context();
  const buffers = new Map();
  const gain = context.createGain(); gain.gain.value = .65; gain.connect(context.destination);
  const playing = new Set(); let sequence=0, enabled=true;
  function stop() { sequence++; for(const s of playing) { try{s.stop();}catch{} } playing.clear(); }
  async function clip(key, token) {
    const buffer=buffers.get(key); if(!buffer||!enabled||token!==sequence)return;
    await new Promise(resolve=>{
      const source=context.createBufferSource(); source.buffer=buffer; source.connect(gain);
      playing.add(source); source.onended=()=>{playing.delete(source);source.disconnect();resolve();};
      source.start();
    });
  }
  return {
    buffers, context,
    async decode(key,bytes){ buffers.set(key,await context.decodeAudioData(bytes.slice(0))); },
    async unlock(){if(context.state==='suspended')await context.resume();},
    setEnabled(value){enabled=value;if(!value)stop();},
    stop,
    async speak(keys){stop();const token=sequence;for(const key of keys){if(token!==sequence)break;await clip(key,token);}},
    effect(key='click'){if(!enabled||context.state!=='running')return;const b=buffers.get(key);if(!b)return;
      const s=context.createBufferSource();s.buffer=b;s.connect(gain);s.onended=()=>{playing.delete(s);s.disconnect();};playing.add(s);s.start();},
    stats(){return {count:buffers.size,decodedBytes:[...buffers.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0),state:context.state,playing:playing.size};},
    dispose(){stop();buffers.clear();context.close();}
  };
}
