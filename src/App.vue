<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue';
import {Simulator} from './simulation/Simulator';
const canvas=ref<HTMLDivElement>(); const values=ref([0,0,0,0,0,0]); const count=ref(0); const paused=ref(false); const error=ref(''); let sim:Simulator|undefined;
const labels=['스윙','메인 붐','아우터 붐','신축 붐','집게 회전','집게']; const keys=[['p',';'],['o','l'],['i','k'],['e','d'],['w','s'],['q','a']];
const leverOrder=[5,4,3,2,1,0];
const leverDirections=[1,-1,-1,1,1,1];
const active=new Map<number,{i:number,y:number,vibrated:boolean}>(); const held=new Set<string>();
function change(i:number,v:number){values.value[i]=v; if(sim)sim.inputs[i]=v;}
function down(e:PointerEvent,i:number){e.preventDefault();(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);active.set(e.pointerId,{i,y:e.clientY,vibrated:false});}
function move(e:PointerEvent){
  const pointer=active.get(e.pointerId);
  if(!pointer || paused.value)return;
  const value=Math.max(-1,Math.min(1,(pointer.y-e.clientY)/45));
  change(pointer.i,value*leverDirections[pointer.i]);
  if(e.pointerType==="touch" && !pointer.vibrated && Math.abs(value)>=0.15){
    pointer.vibrated=true;
    navigator.vibrate?.(25);
  }
}
function up(e:PointerEvent){const p=active.get(e.pointerId);if(p){change(p.i,0);active.delete(e.pointerId);}}
function key(e:KeyboardEvent,on:boolean){const k=e.key.toLowerCase();if(!keys.flat().includes(k))return;e.preventDefault();on?held.add(k):held.delete(k);keys.forEach(([up,down],i)=>{
  if([...active.values()].some(pointer=>pointer.i===i))return;
  const direction=Number(held.has(up))-Number(held.has(down));
  change(i,direction*leverDirections[i]);
});}
const kd=(e:KeyboardEvent)=>key(e,true),ku=(e:KeyboardEvent)=>key(e,false);function stop(){held.clear();active.clear();values.value.fill(0);sim?.inputs.fill(0);}
function toggle(){paused.value=!paused.value;stop();if(sim)sim.paused=paused.value;}
function reset(){stop();sim?.reset();count.value=0;paused.value=false;if(sim)sim.paused=false;}
onMounted(()=>{try{sim=new Simulator(canvas.value!,n=>count.value=n);}catch(e){error.value=String(e);}window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);});
onBeforeUnmount(()=>{sim?.dispose();window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);});
</script>
<template><main><div ref="canvas" class="scene"></div><header><div><strong>GRAPPLE / 01</strong><small>집게차 조작 연습 · 1인칭</small></div><div class="score">적재 <b>{{count}} / 12</b></div><div class="actions"><button @click="sim?.centerView()">정면</button><button @click="toggle">{{paused?'계속':'정지'}}</button><button @click="reset">초기화</button></div></header><div class="hint">화면 드래그: 시선 이동 · 레버를 위아래로 드래그 · 손을 떼면 중립</div><div v-if="error" class="message">3D 실행 실패: {{error}}</div><div v-else-if="paused" class="message">일시정지</div><div v-else-if="count===12" class="message">모든 폐기물 적재 완료!</div><footer><div v-for="i in leverOrder" :key="i" class="control"><div class="lever" @pointerdown="down($event,i)" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up"><div class="track"></div><div class="handle" :style="{'--lever-input': values[i]*leverDirections[i]}"></div></div><b>{{labels[i]}}</b><small>{{keys[i][0].toUpperCase()}} / {{keys[i][1].toUpperCase()}}</small></div></footer></main></template>
