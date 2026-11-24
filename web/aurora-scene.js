/* Aurora v5: offline Canvas motion, broken lake reflections, centered saucer. */
(function(root){
 'use strict';
 const id='finland-aurora',image='assets/backgrounds/finland-aurora-night.webp';
 // Retained for catalog/archive compatibility; playback no longer needs a media decoder.
 const videoPath='assets/backgrounds/finland-aurora-motion.mp4';
 const scene={id,title:['오로라 산장','Aurora Lodge'],width:398,height:814};
 const anchor={x:.5,y:.724,width:.16};
 function placement(saved){
  const source=saved?.source;
  // Only migrate the exact former automatic default. Hand-positioned pots are literal.
  if(source?.tableDefault&&source.x===.5&&source.y===.762&&source.width===.16)return {...saved,source:{...source,...anchor}};
  return saved;
 }
 function paintScene(ctx,photo,time,sky,water){
  const t=time/1000;
  ctx.clearRect(0,0,398,814);ctx.drawImage(photo,0,0,398,814);
  // Moving samples of the approved diffuse sky; frame, forest and room stay fixed.
  const c=sky.getContext('2d');c.clearRect(0,0,398,814);
  for(let y=96;y<390;y+=2){
   const wave=14*Math.sin(t*.24+y*.008)+7*Math.sin(t*.41+y*.023);
   const sy=Math.max(96,Math.min(387,y+5*Math.sin(t*.3+y*.014)));
   c.globalAlpha=Math.min(1,(y-96)/18,(390-y)/18);
   c.drawImage(photo,47+wave*.65,sy,300,2,31,y,333,2);
  }
  c.globalAlpha=1;c.globalCompositeOperation='destination-in';
  const edge=c.createLinearGradient(31,0,364,0);edge.addColorStop(0,'transparent');edge.addColorStop(.05,'#fff');edge.addColorStop(.95,'#fff');edge.addColorStop(1,'transparent');c.fillStyle=edge;c.fillRect(31,96,333,294);c.globalCompositeOperation='source-over';
  ctx.drawImage(sky,0,0);
  // Feather clean water over the old bright vertical spot, then spread the light
  // across short, uneven horizontal ripples. All coordinates exclude the shore.
  const w=water.getContext('2d');w.clearRect(0,0,398,814);
  w.drawImage(photo,51,430,43,93,91,430,86,93);
  w.globalCompositeOperation='destination-in';w.save();w.translate(134,472);w.scale(1,1.15);
  const feather=w.createRadialGradient(0,0,12,0,0,42);feather.addColorStop(0,'#fff');feather.addColorStop(.55,'#fff');feather.addColorStop(1,'transparent');w.fillStyle=feather;w.fillRect(-45,-45,90,90);w.restore();w.globalCompositeOperation='source-over';
  ctx.drawImage(water,0,0);ctx.save();ctx.beginPath();
  [[34,435],[202,435],[222,457],[251,475],[286,492],[246,515],[193,533],[71,559],[34,559]].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();
  for(let i=0;i<34;i++){
   const depth=i/33,y=438+i*2.35,center=139+9*Math.sin(t*.25)+Math.sin(i*1.7+t*.7)*(3+depth*9);
   const width=(23+depth*99)*(.65+.35*Math.sin(i*2.3+t*.8)**2);
   const alpha=(.12*(1-depth)+.018)*(.55+.45*Math.sin(i*1.9-t*.9)**2);
   const g=ctx.createLinearGradient(center-width/2,0,center+width/2,0);g.addColorStop(0,'transparent');g.addColorStop(.3,'rgba(70,224,159,'+alpha+')');g.addColorStop(.7,'rgba(70,224,159,'+alpha+')');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(center-width/2,y,width,1+depth*.65);
  }
  ctx.restore();
 }
 function mountSurface(host,options={}){
  const doc=host.ownerDocument,canvas=doc.createElement('canvas'),photo=doc.createElement('img');
  const sky=doc.createElement('canvas'),water=doc.createElement('canvas');
  for(const c of [canvas,sky,water]){c.width=398;c.height=814;}
  canvas.hidden=true;canvas.className='bbAuroraCanvas';canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:1';host.append(canvas);
  const ctx=canvas.getContext('2d'),motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  let active=false,disposed=false,visible=true,ready=false,loading=false,frame=0,last=-Infinity,time=0;
  function paint(){if(disposed||!active||!ready||!ctx)return;try{paintScene(ctx,photo,motion?.matches?0:time,sky,water);canvas.hidden=false;}catch(_){canvas.hidden=true;}}
  function stop(){if(frame)root.cancelAnimationFrame(frame);frame=0;}
  function loop(now){frame=0;if(!active||disposed||doc.hidden||!visible||motion?.matches)return;
   if(now-last>=1000/24){time=now;paint();last=now;}frame=root.requestAnimationFrame(loop);
  }
  async function load(){
   if(loading||ready||disposed)return;loading=true;
   try{
    const url=new URL(image,options.base||doc.baseURI);let source=url.href;
    if(url.protocol==='file:'){
     if(root.BloomBreakIOS?.imageAsset)source=await root.BloomBreakIOS.imageAsset(url.href);
     else if(root.AndroidBridge?.gazeImageAsset)source=root.AndroidBridge.gazeImageAsset(url.pathname.replace('/android_asset/',''));
     else throw Error('native image bridge unavailable');
     if(typeof source!=='string'||!/^data:image\//.test(source))throw Error('native image unavailable');
    }
    if(disposed)return;
    photo.onload=()=>{if(disposed)return;loading=false;ready=photo.naturalWidth>0;sync();};
    photo.onerror=()=>{loading=false;ready=false;canvas.hidden=true;stop();};photo.src=source;
   }catch(_){loading=false;canvas.hidden=true;}
  }
  function sync(){stop();last=-Infinity;if(!active||disposed){canvas.hidden=true;return;}
   if(!ready){load();return;}paint();if(doc.hidden||!visible||motion?.matches)return;
   frame=root.requestAnimationFrame(loop);
  }
  function retry(){if(active&&!disposed&&!doc.hidden&&visible&&!ready)load();}
  host.addEventListener('pointerup',retry);root.addEventListener?.('pageshow',sync);
  const observer=root.IntersectionObserver?new root.IntersectionObserver(entries=>{visible=entries.at(-1)?.isIntersecting!==false;sync();}):null;observer?.observe(host);
  doc.addEventListener('visibilitychange',sync);motion?.addEventListener?.('change',sync);host.addEventListener('bloom-capture-frame',paint);
  return {canvas,photo,setActive(value){if(active===!!value)return;active=!!value;sync();},paint,destroy(){if(disposed)return;disposed=true;stop();observer?.disconnect();doc.removeEventListener('visibilitychange',sync);motion?.removeEventListener?.('change',sync);host.removeEventListener('bloom-capture-frame',paint);host.removeEventListener('pointerup',retry);root.removeEventListener?.('pageshow',sync);photo.onload=null;photo.onerror=null;photo.removeAttribute('src');canvas.remove();}};
 }
 function mountRoom(room){const surface=mountSurface(room);
  const apply=()=>surface.setActive(room.dataset.scene===id&&!room.classList.contains('has-photo')&&!room.classList.contains('editing'));
  const observer=new root.MutationObserver(apply);observer.observe(room,{attributes:true,attributeFilter:['data-scene','class']});apply();
  return ()=>{observer.disconnect();surface.destroy();};
 }
 function mountPreview(host,options={}){
  const doc=host.ownerDocument,stage=doc.createElement('figure'),photo=doc.createElement('img');
  stage.className='bbPremiumPreviewStage';stage.style.cssText='position:relative;margin:0;aspect-ratio:398/814;overflow:hidden';
  stage.style.setProperty('--bb-preview-ratio',String(398/814));photo.alt=scene.title[/^en/i.test(doc.documentElement.lang)?1:0];
  photo.style.cssText='display:block;width:100%;height:100%;object-fit:cover';photo.src=new URL(image,options.base||doc.baseURI).href;
  stage.append(photo);host.classList.add('bbPremiumPreview');
  const viewport=doc.createElement('div');viewport.className='bbPremiumPreviewViewport';viewport.append(stage);host.append(viewport);
  const surface=mountSurface(stage,options);surface.setActive(true);return ()=>{surface.destroy();viewport.remove();};
 }
 const api={id,image,videoPath,scene,anchor,placement,paintScene,mountSurface,mountRoom,mountPreview};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BloomBreakAuroraScene=api;
})(typeof window==='undefined'?globalThis:window);
