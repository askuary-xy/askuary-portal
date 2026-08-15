import '../styles/stardust-cursor.css';

type Point = { x:number; y:number; life:number; size:number };
type Spark = Point & { vx:number; vy:number; hue:number };

let mounted=false;

export function mountStardustCursor(): void {
  if(mounted || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  mounted=true;
  const canvas=document.createElement('canvas');
  canvas.id='stardustCursor';
  canvas.setAttribute('aria-hidden','true');
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d',{alpha:true});
  if(!ctx){canvas.remove();return;}
  const trail:Point[]=[];
  const sparks:Spark[]=[];
  const fine=matchMedia('(pointer:fine)').matches;
  let width=0,height=0,dpr=1,raf=0,lastX=-100,lastY=-100,lastMove=0,visible=true;

  const resize=()=>{
    width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
  };
  const wake=()=>{if(!raf&&visible)raf=requestAnimationFrame(draw);};
  const addTrail=(x:number,y:number)=>{
    const now=performance.now();
    if(now-lastMove<18||Math.hypot(x-lastX,y-lastY)<3)return;
    lastMove=now;lastX=x;lastY=y;
    trail.push({x,y,life:1,size:1.4+Math.random()*1.8});
    if(trail.length>22)trail.shift();
    wake();
  };
  const burst=(x:number,y:number)=>{
    const count=fine?14:9;
    for(let i=0;i<count;i+=1){
      const angle=Math.PI*2*i/count+Math.random()*.25;
      const speed=1.1+Math.random()*2.6;
      sparks.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-.3,life:1,size:1+Math.random()*2.2,hue:Math.random()>.25?195:42});
    }
    wake();
  };
  const draw=()=>{
    raf=0;ctx.clearRect(0,0,width,height);
    if(trail.length>1){
      ctx.beginPath();ctx.moveTo(trail[0].x,trail[0].y);
      for(let i=1;i<trail.length;i+=1)ctx.lineTo(trail[i].x,trail[i].y);
      ctx.strokeStyle='rgba(105,211,255,.16)';ctx.lineWidth=.7;ctx.stroke();
    }
    for(let i=trail.length-1;i>=0;i-=1){
      const p=trail[i];p.life-=.035;
      if(p.life<=0){trail.splice(i,1);continue;}
      ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);
      ctx.fillStyle=`rgba(126,220,255,${p.life*.7})`;ctx.fill();
    }
    for(let i=sparks.length-1;i>=0;i-=1){
      const p=sparks[i];p.life-=.026;p.vy+=.025;p.x+=p.vx;p.y+=p.vy;p.vx*=.985;p.vy*=.985;
      if(p.life<=0){sparks.splice(i,1);continue;}
      const alpha=p.life*.9;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.life*2);
      ctx.strokeStyle=`hsla(${p.hue},90%,72%,${alpha})`;ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(-p.size*2,0);ctx.lineTo(p.size*2,0);ctx.moveTo(0,-p.size*2);ctx.lineTo(0,p.size*2);ctx.stroke();ctx.restore();
    }
    if(trail.length||sparks.length)wake();
  };
  if(fine)document.addEventListener('pointermove',event=>addTrail(event.clientX,event.clientY),{passive:true});
  document.addEventListener('pointerdown',event=>{
    if((event.target as HTMLElement)?.closest('canvas,[role="application"]'))return;
    burst(event.clientX,event.clientY);
  },{passive:true});
  document.addEventListener('visibilitychange',()=>{
    visible=!document.hidden;
    if(!visible&&raf){cancelAnimationFrame(raf);raf=0;}
    else wake();
  });
  addEventListener('resize',resize,{passive:true});
  resize();
}
