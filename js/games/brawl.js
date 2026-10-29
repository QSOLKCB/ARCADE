/* Original arena combat, characters and procedural artwork. SPDX-License-Identifier: Apache-2.0 */
(function(A){
  'use strict';
  const D=A.Draw;
  const FIGHTERS=[
    {name:'MARA / THE WELDER',color:'#66d8c1',hp:130,speed:109,power:1},
    {name:'BOLT / THE COURIER',color:'#e6bd65',hp:105,speed:139,power:.88},
    {name:'ROOK / THE DOCKHAND',color:'#bf9ee7',hp:165,speed:86,power:1.2}
  ];
  const ROUNDS=[
    {name:'KNUCKLE TAX',enemies:[['SCRAPJACK','brawler',200]]},
    {name:'KEEP YOUR DISTANCE',enemies:[['VELVET VICE','kicker',250]]},
    {name:'TWO FOR THE FLOOR',enemies:[['DENT','brawler',190],['DING','runner',170]]},
    {name:'NO FREE CORNERS',enemies:[['BRASS MONK','guard',400]]},
    {name:'LAST CALL',enemies:[['THE FOREMAN','boss',600]]}
  ];
  function fighter(c,p,color){
    if(p.hp<=0)return;
    D.shadow(c,p.x,p.y,15);c.save();c.translate(p.x,p.y-p.z);c.scale(p.face,1);
    if(p.inv>0&&Math.floor(p.inv*18)%2)c.globalAlpha=.5;
    const kick=p.attack>0&&p.move==='kick',punch=p.attack>0&&p.move!=='kick',step=Math.sin(p.walk*13)*4;
    D.rect(c,-9,-20,7,18+step,'#253142');D.rect(c,3,-20,7,kick?8:18-step,'#253142');
    D.rect(c,-12,-3+step,11,5,'#141b29');
    if(kick){D.rect(c,6,-20,23,7,'#334a5a');D.rect(c,26,-22,9,9,'#eee0c4');}
    else D.rect(c,3,-3-step,12,5,'#141b29');
    D.rect(c,-12,-42,24,25,p.stun>0?'#fff2ce':color);D.rect(c,-8,-39,5,13,'#ffffff22');D.rect(c,-13,-22,26,5,'#211d29');
    D.rect(c,-7,-54,14,13,'#d9a380');D.rect(c,-8,-56,16,5,'#20202b');D.rect(c,2,-49,4,2,'#131c24');
    D.rect(c,-18,-39,7,18,'#c99170');D.rect(c,-19,-24,9,8,'#f0c49d');
    if(p.block){D.rect(c,10,-47,7,17,'#d9a380');D.rect(c,7,-49,12,8,color);}
    else if(punch){D.rect(c,11,-38,21,8,'#d9a380');D.rect(c,29,-40,10,11,color);}
    else{D.rect(c,11,-40,7,19,'#d9a380');D.rect(c,11,-25,9,9,color);}
    if(p.weapon){D.rect(c,punch?31:18,-31,3,26,'#d0d5d8');D.rect(c,punch?30:17,-34,15,4,'#d0d5d8');D.rect(c,punch?43:30,-33,3,25,'#6d8495');D.rect(c,punch?33:20,-28,10,7,'#9fb2b7');}
    c.restore();
  }
  A.Brawl=class extends A.Game{
    constructor(options,sound){super(options,sound);this.id='brawl';this.options.players=1;this.choice=[0,1,2].includes(this.options.fighter)?this.options.fighter:0;this.round=0;this.combo=0;this.comboTime=0;this.rand=A.rng(6220);this.setup(true);}
    setup(fresh=false){
      const f=FIGHTERS[this.choice],hp=f.hp*(this.relaxed?1.45:1);
      this.player={x:145,y:193,z:0,vz:0,hp:fresh?hp:Math.min(hp,this.player.hp+55),maxHP:hp,face:1,walk:0,cd:0,inv:.6,stun:0,attack:0,weapon:0,block:false,move:'punch'};
      this.enemies=ROUNDS[this.round].enemies.map(([name,kind,hp],i)=>({name,kind,x:320+i*54,y:184+i*31,z:0,vz:0,hp,maxHP:hp,face:-1,walk:0,cd:1+i*.8,windup:0,stun:0,poise:0,attack:0,inv:0,block:false,move:'punch',weapon:0}));
      this.props=[{x:72,y:214,hits:3},{x:411,y:158,hits:3}];this.falls=[];this.remaining=99;this.combo=0;this.comboTime=0;this.particles.items=[];this.effects.items=[];
    }
    menu(){return{eyebrow:'BASEMENT BRAWL · BOUT '+(this.round+1)+' / '+ROUNDS.length,title:this.state==='stageclear'?'Still standing. Next challenger.':'The basement has a new contender.',description:'Five bouts. No ropes. Work the depth of the arena, bait a swing and punish the opening. A chair helps; a corner does not. Your health recovers partly between bouts.',details:'WASD / arrows move · J punch / chair · K kick · Space jump · E pick up a chair or throw a staggered foe; hold E to guard. Three landed punches build a heavy combo.',choices:this.state==='briefing'?FIGHTERS.map((f,i)=>({label:f.name+' · '+(i===0?'balanced':i===1?'fast':'power'),id:'fighter'+i,selected:i===this.choice})):undefined,button:this.state==='stageclear'?'Next bout':'Enter the pit',action:'start'};}
    action(id){
      if(this.state==='briefing'&&/^fighter[0-2]$/.test(id)){this.choice=Number(id.slice(-1));this.options.fighter=this.choice;this.setup(true);}
      if(id!=='start')return;
      if(this.state==='stageclear'){this.round++;this.setup();this.state='playing';}
      else if(this.state==='briefing')this.state='playing';
    }
    damage(e,amount,face,throwing=false){
      if(e.hp<=0)return;
      if(e.block&&!throwing){amount*=.22;this.sound('empty');}
      e.hp=Math.max(0,e.hp-amount);
      // Brief hit recovery lets a combo land; poise prevents a held punch from
      // cancelling every enemy wind-up forever. Throws still break through.
      if(throwing||e.poise<=0){e.stun=throwing?.8:.16;e.windup=0;e.cd=Math.max(e.cd,.25);e.poise=e.kind==='boss'?1.5:1.05;}
      e.x=A.clamp(e.x+face*(throwing?65:10),35,445);this.effects.add('ring',e.x,e.y-28,'#ffe1a7',18,.2);
      this.particles.burst(e.x,e.y-28,'#f9c897',9,70);this.sound('hit');this.shake=.08;
      if(e.hp===0){this.score+=600+this.round*150;this.falls.push({...e,life:1});this.sound('boom');}
    }
    strike(kind){
      const p=this.player,f=FIGHTERS[this.choice];if(p.cd>0||p.stun>0)return;
      const weapon=p.weapon>0&&kind==='punch',kick=kind==='kick',air=p.z>8;
      p.cd=kick?.56:.34;p.attack=.19;p.move=kind;p.block=false;
      const reach=weapon?65:kick?55:40;
      const targets=this.enemies.filter(e=>e.hp>0&&Math.abs(e.y-p.y)<20&&Math.abs(e.x-p.x)<reach&&(e.x-p.x)*p.face>-8);
      this.effects.add('slash',p.x+p.face*15,p.y-p.z-27,weapon?'#fff7cf':'#a8dfd5',reach*.65,.16,p.face);this.sound('slash');
      for(const e of targets){
        this.combo=this.comboTime>0?this.combo+1:1;this.comboTime=1.2;
        const heavy=this.combo%3===0,damage=(weapon?36:kick?24:17)*f.power*(air?1.35:1)*(heavy?1.5:1);
        this.damage(e,damage,p.face);this.score+=15;
        if(heavy){this.say('THREE-HIT COMBO',1);this.shake=.15;}
      }
      if(weapon){p.weapon--;if(!p.weapon){this.particles.burst(p.x+20*p.face,p.y-20,'#adbac4',20,95);this.say('CHAIR BROKEN',1);}}
    }
    enemyStrike(e){
      const p=this.player,kick=e.kind==='kicker'||e.kind==='boss';e.attack=.22;e.move=kick?'kick':'punch';
      const reach=kick?57:40;
      if(p.hp>0&&p.inv<=0&&p.z<17&&Math.abs(p.y-e.y)<20&&Math.abs(p.x-e.x)<reach){
        const front=(e.x-p.x)*p.face>=-3,guarded=p.block&&front;
        const damage=(e.kind==='boss'?24:16)*(this.relaxed?.7:1)*(guarded?.12:1);
        p.hp=Math.max(0,p.hp-damage);p.inv=guarded?.15:.65;p.stun=guarded?0:.2;p.x=A.clamp(p.x+Math.sign(p.x-e.x)*8,35,445);
        this.sound(guarded?'empty':'hurt');this.shake=guarded?0:.13;
      }
      e.cd=(e.kind==='runner'?.75:e.kind==='boss'?.9:1.1)*(this.relaxed?1.3:1);
    }
    update(dt,inputs){
      if(this.state!=='playing')return;this.common(dt);this.remaining-=dt;this.comboTime-=dt;
      const a=inputs[0]||A.emptyInput(),p=this.player,f=FIGHTERS[this.choice];
      p.cd-=dt;p.inv-=dt;p.stun-=dt;p.attack-=dt;
      if(a.jumpPressed&&p.z===0&&p.stun<=0){p.vz=245;this.sound('jump');}
      p.z=Math.max(0,p.z+p.vz*dt);p.vz-=720*dt;if(p.z===0)p.vz=0;
      p.block=a.interact&&p.z===0&&p.attack<=0;
      if(p.stun<=0){
        const speed=f.speed*(p.block?.3:1);p.x=A.clamp(p.x+a.x*speed*dt,35,445);p.y=A.clamp(p.y+a.y*speed*.6*dt,133,233);
        if(a.x){p.face=Math.sign(a.x);p.walk+=dt;}if(a.y)p.walk+=dt;
        if(a.interactPressed){
          const prop=this.props.find(q=>q.hits>0&&A.dist(p,q)<28),foe=this.enemies.find(e=>e.hp>0&&e.stun>0&&A.dist(p,e)<48);
          if(foe){this.damage(foe,45*f.power,p.face,true);p.cd=.7;this.say('OVER YOU GO!',1);}
          else if(prop&&!p.weapon){p.weapon=prop.hits;prop.hits=0;this.sound('pickup');this.say('CHAIR · THREE SWINGS',1.5);}
        }
        if(a.specialPressed)this.strike('kick');else if(a.fire)this.strike('punch');
      }
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.cd-=dt;e.stun-=dt;e.poise-=dt;e.attack-=dt;e.face=p.x>=e.x?1:-1;
        e.block=e.kind==='guard'&&e.cd>.25&&e.stun<=0&&e.windup<=0;
        if(e.stun>0)continue;
        if(e.windup>0){e.windup-=dt;if(e.windup<=0)this.enemyStrike(e);continue;}
        const reach=e.kind==='kicker'?43:29,dx=p.x-e.x,dy=p.y-e.y;
        if(Math.abs(dx)>reach||Math.abs(dy)>9){const speed=e.kind==='runner'?78:e.kind==='boss'?54:47;e.x+=Math.sign(dx)*Math.min(Math.max(0,Math.abs(dx)-reach),speed*dt);e.y+=Math.sign(dy)*Math.min(Math.abs(dy),speed*.55*dt);e.walk+=dt;}
        if(Math.abs(dx)<reach+8&&Math.abs(dy)<16&&e.cd<=0){e.windup=this.relaxed?.65:.42;e.block=false;}
        if(A.dist(p,e)<19){const n=A.unit(p.x-e.x,p.y-e.y);p.x=A.clamp(p.x+n.x*35*dt,35,445);p.y=A.clamp(p.y+n.y*35*dt,133,233);}
      }
      for(const fall of this.falls)fall.life-=dt;this.falls=this.falls.filter(f=>f.life>0);
      if(p.hp<=0||this.remaining<=0){this.finish(false);return;}
      if(this.enemies.every(e=>e.hp===0)){
        this.score+=Math.ceil(this.remaining)*10;
        if(this.round===ROUNDS.length-1)this.finish(true);else{this.state='stageclear';this.sound('win');}
      }
    }
    status(){return 'Bout '+(this.round+1)+'/5 · '+FIGHTERS[this.choice].name+' · Health '+Math.ceil(this.player.hp)+' · '+Math.ceil(this.remaining)+'s · Score '+this.score;}
    render(c){
      D.rect(c,0,0,480,270,'#151321');D.rect(c,0,70,480,73,'#342537');
      for(let i=0;i<34;i++){const x=10+i*14,y=92+(i%3)*13,bob=Math.sin(this.time*3+i)*2;D.rect(c,x,y+bob,7,9,['#a78377','#c39f7e','#795b5a'][i%3]);D.rect(c,x-2,y+9+bob,11,17,['#45515c','#6b404f','#586353'][i%3]);if(i%3===0)D.rect(c,x+9,y+2+bob,3,15,'#b1947c');}
      D.rect(c,153,36,174,35,'#080e17');D.text(c,'THE UNDERPASS',240,43,'#efb66e',14,'center');D.text(c,'FIVE BOUTS / ONE WAY OUT',240,61,'#846d79',6,'center');
      D.rect(c,0,129,480,141,'#56494c');
      c.strokeStyle='#ad8e6b55';for(let i=-5;i<12;i++){c.beginPath();c.moveTo(240+(i-3)*30,130);c.lineTo(240+(i-3)*85,270);c.stroke();}
      for(const y of[142,163,191,231])D.rect(c,0,y,480,1,'#c0a68a35');
      c.strokeStyle='#e5c27a';c.lineWidth=2;c.strokeRect(30,140,420,96);c.lineWidth=1;
      D.text(c,'NO REFUNDS',240,193,'#998575',17,'center');
      for(const q of this.props)if(q.hits){D.rect(c,q.x-9,q.y-17,18,4,'#b0b7ba');D.rect(c,q.x-9,q.y-12,3,16,'#b0b7ba');D.rect(c,q.x+6,q.y-12,3,16,'#6e8b97');D.text(c,'E',q.x,q.y-29,'#f3dc9d',8,'center');}
      for(const f of this.falls){c.globalAlpha=f.life;D.rect(c,f.x-25,f.y-8,45,10,'#a77b78');c.globalAlpha=1;}
      const actors=[this.player,...this.enemies].sort((a,b)=>a.y-b.y);
      for(const p of actors){
        if(p.hp<=0)continue;const enemy=p!==this.player;
        if(p.windup>0){D.text(c,'!',p.x,p.y-72,'#ffad73',17,'center');D.bar(c,p.x-17,p.y+6,34,p.windup,this.relaxed?.65:.42,'#ffb47a');}
        fighter(c,p,enemy?(p.kind==='boss'?'#f2a372':p.kind==='guard'?'#c3c6b5':'#b68c9f'):FIGHTERS[this.choice].color);
        if(enemy){D.bar(c,p.x-25,p.y-66,50,p.hp,p.maxHP,'#efad89');D.text(c,p.name,p.x,p.y-76,'#e4c6a9',6,'center');}
      }
      this.particles.draw(c);this.effects.draw(c);
      D.hud(c,this,'BOUT '+(this.round+1)+' / 5 · '+ROUNDS[this.round].name,Math.ceil(this.remaining)+'s / '+this.score);
      D.bar(c,10,30,130,this.player.hp,this.player.maxHP,FIGHTERS[this.choice].color);D.text(c,'VITALITY '+Math.ceil(this.player.hp),10,38,'#e2d4c1',7);
      if(this.player.weapon)D.text(c,'CHAIR '+this.player.weapon,470,31,'#e2d4c1',8,'right');
    }
  };
})(globalThis.Arcade);
