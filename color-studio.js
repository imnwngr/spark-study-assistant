/* Chromatic studio controls. State stays local until Save. */
(() => {
  'use strict';
  const A=SparkAppearance;
  const $=id=>document.getElementById(id);
  const nameKeys={glacier:['Glacier','Băng lam','冰川蓝','冰川藍'],aurora:['Sage','Xô thơm','鼠尾草绿','鼠尾草綠'],orchid:['Lilac','Tử đinh hương','丁香紫','丁香紫'],rose:['Blush','Hồng phấn','浅玫瑰','淺玫瑰'],peach:['Apricot','Mơ nhạt','杏桃色','杏桃色'],citron:['Butter','Vàng bơ','奶油黄','奶油黃'],seafoam:['Mint','Bạc hà','薄荷绿','薄荷綠'],midnight:['Dusk','Lam chiều','暮光蓝','暮光藍'],neutral:['Silver','Bạc sương','银灰色','銀灰色']};
  const langIndex=()=>({en:0,vi:1,'zh-CN':2,'zh-TW':3})[SparkI18n.language]||0;
  function name(id){return (nameKeys[id]||[])[langIndex()]||SparkI18n.t('colorCustom');}
  function mount(onChange=()=>{}){
    let color=A.DEFAULT_COLOR,strength=A.DEFAULT_STRENGTH;
    const presetRoot=$('colorPresets'),hex=$('colorHex'),native=$('nativeColor'),wheel=$('colorWheel'),knob=$('wheelKnob'),strengthInput=$('wallStrength');
    for(const p of A.PRESETS){
      const btn=document.createElement('button');btn.type='button';btn.className='color-swatch';btn.dataset.color=p.color;btn.dataset.preset=p.id;
      const core=document.createElement('span');core.className='swatch-core';core.style.setProperty('--swatch-color',p.color);core.setAttribute('aria-hidden','true');btn.append(core);
      btn.addEventListener('click',()=>set(p.color,strength,true));presetRoot.append(btn);
    }
    function render(){
      A.apply(color,strength);
      hex.value=color;hex.removeAttribute('aria-invalid');native.value=color;
      $('colorSample').style.backgroundColor=color;
      const match=A.PRESETS.find(p=>p.color===color);
      $('selectedColorName').textContent=match?name(match.id):SparkI18n.t('colorCustom');
      for(const el of presetRoot.children){
        const active=el.dataset.color===color;el.classList.toggle('is-selected',active);el.setAttribute('aria-pressed',String(active));
        const label=name(el.dataset.preset);el.setAttribute('aria-label',label);el.title=label;
      }
      const hue=A.hueFromHex(color);
      wheel.setAttribute('aria-valuenow',String(Math.round(hue)));
      wheel.setAttribute('aria-valuetext',`${Math.round(hue)}°`);
      wheel.setAttribute('aria-label',SparkI18n.t('colorWheel'));
      knob.style.transform=`rotate(${hue}deg) translateY(-${wheel.clientWidth<150?63:73}px)`;
      $('wheelCenter').style.backgroundColor=color;
      strengthInput.value=String(strength);$('strengthValue').textContent=`${strength}%`;
    }
    function set(nextColor,nextStrength,notify=false){
      color=A.normalizeColor(nextColor);strength=A.normalizeStrength(nextStrength);render();
      if(notify)onChange({color,strength});
    }
    function setHue(angle){set(A.hslToHex(angle,.48,.72),strength,true);}
    function pointer(e){
      const r=wheel.getBoundingClientRect();const x=e.clientX-r.left-r.width/2;const y=e.clientY-r.top-r.height/2;
      if(Math.hypot(x,y)<36)return; // centre preview is not an interactive target
      const angle=(Math.atan2(x,-y)*180/Math.PI+360)%360;setHue(angle);
    }
    wheel.addEventListener('pointerdown',e=>{wheel.setPointerCapture?.(e.pointerId);pointer(e);});
    wheel.addEventListener('pointermove',e=>{if(e.buttons&1)pointer(e);});
    wheel.addEventListener('keydown',e=>{
      let change={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key];
      if(e.key==='Home'){e.preventDefault();setHue(0);return;}
      if(e.key==='End'){e.preventDefault();setHue(359);return;}
      if(change){e.preventDefault();setHue((A.hueFromHex(color)+change*(e.shiftKey?10:1)+360)%360);}
    });
    hex.addEventListener('input',()=>{
      const proposed=hex.value.trim();
      if(/^#[\da-fA-F]{6}$/.test(proposed))set(proposed,strength,true);
      else hex.setAttribute('aria-invalid','true');
    });
    hex.addEventListener('blur',()=>{if(hex.getAttribute('aria-invalid')==='true')hex.value=color;hex.removeAttribute('aria-invalid');});
    native.addEventListener('input',()=>set(native.value,strength,true));
    strengthInput.addEventListener('input',()=>set(color,strengthInput.value,true));
    $('resetColor').addEventListener('click',()=>set(A.DEFAULT_COLOR,A.DEFAULT_STRENGTH,true));
    document.addEventListener('spark-language-changed',render);
    render();
    return {set,get:()=>({color,strength}),render};
  }
  globalThis.SparkColorStudio={mount};
})();
