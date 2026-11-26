import * as T from 'three';
import {OBB} from 'three/addons/math/OBB.js';
const clamp=T.MathUtils.clamp; const deg=T.MathUtils.degToRad;
const mat=(color:number)=>new T.MeshStandardMaterial({color,roughness:.78});
const orange=mat(0xe77d24),dark=mat(0x303a40),steel=mat(0x82939b),white=mat(0xdce1df),wood=mat(0x93704c);
function box(parent:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
function group(parent:T.Object3D,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
function beam(parent:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,m:T.Material){const v=b.clone().sub(a);const o=new T.Mesh(new T.CylinderGeometry(r,r,v.length(),8),m);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.normalize());parent.add(o);return o;}
type Waste={mesh:T.Mesh,halfSize:T.Vector3,fallSpeed:number,held:boolean,loaded:boolean,offset:T.Vector3};
type Axis='x'|'y'|'z';
const collisionAxes:Axis[]=['x','y','z'];
const bedTop=1.19;
const truckWidthScale=1.22;
const truckLengthScale=1.15;
const bedRear=.88;
const truckZ=(z:number)=>bedRear+(z-bedRear)*truckLengthScale;
export class Simulator{
 inputs=[0,0,0,0,0,0]; paused=false; private scene=new T.Scene();private camera=new T.PerspectiveCamera(73,1,.05,100);private renderer:T.WebGLRenderer;private base:T.Group;private main:T.Group;private outer:T.Group;private extension:T.Group;private extensionBeam:T.Mesh;private tip:T.Group;private claw:T.Group;private rot:T.Group;private jaws:T.Group[]=[];private eye:T.Group;private waste:Waste[]=[];private obstacles:T.Box3[]=[];private craneColliders:{mesh:T.Mesh,local:OBB}[]=[];private worldCollider=new OBB();private angles=[0,deg(48),deg(-65),.6,0,1];private rates=[0,0,0,0,0,0];private yaw=0;private pitch=0;private frame=0;private last=0;private resizeObserver:ResizeObserver;private dragging:number|null=null;private lastX=0;private lastY=0;private host:HTMLElement;private report:(n:number)=>void;
 constructor(host:HTMLElement,report:(n:number)=>void){this.host=host;this.report=report;this.scene.background=new T.Color(0xb6ceda);this.scene.fog=new T.Fog(0xb6ceda,25,85);this.renderer=new T.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;host.appendChild(this.renderer.domElement);this.scene.add(new T.HemisphereLight(0xe9f5ff,0x69665c,2.1));const sun=new T.DirectionalLight(0xfff1d7,2.3);sun.position.set(-9,15,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.5,far:40});this.scene.add(sun);this.addObstacle(0,-.16,0,65,.3,65,mat(0x92938a));const grid=new T.GridHelper(60,60,0x7b8079,0x858981);grid.position.y=.005;this.scene.add(grid);
 for(let i=0;i<8;i++){this.addObstacle(-13+i*3,2,-14,2.9,4,2.5,mat(i%2?0x86979b:0x697c85));}this.addObstacle(-14,1.5,0,.3,3,27,steel);this.addObstacle(14,1.5,0,.3,3,27,steel);
 // Keep the rear of the bed next to the crane as the truck grows.
 const truckObstacle=(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material)=>
   this.addObstacle(x*truckWidthScale,y,truckZ(z),w*truckWidthScale,h,d*truckLengthScale,material);
 truckObstacle(0,.73,3,2.35,.48,8,dark);
 truckObstacle(0,1.65,6.2,2.4,1.7,1.7,white);
 box(this.scene,0,2,truckZ(7.07),2*truckWidthScale,.64,.04,mat(0x557887));
 truckObstacle(0,1.08,3.4,2.5,.22,5.1,steel);
 for(const x of [-1.24,1.24])truckObstacle(x,1.75,3.4,.15,1.2,5.1,steel);
 for(const z of [bedRear,5.92])truckObstacle(0,1.75,z,2.5,1.2,.15,steel);
 for(const x of [-1.25,1.25])for(const z of [0,1.5,5.9]){
   const wheel=new T.Mesh(new T.CylinderGeometry(.55,.55,.38,16),dark);
   wheel.rotation.z=Math.PI/2;
   wheel.position.set(x*truckWidthScale,.55,truckZ(z));
   this.scene.add(wheel);
 }
 for(const x of [-2.15,2.15]){box(this.scene,x,.73,0,1.6,.18,.22,steel);box(this.scene,x,.38,0,.18,.72,.18,steel);box(this.scene,x,.07,0,.5,.12,.5,dark);}box(this.scene,0,1.15,0,1.3,.65,1.3,orange);
 this.base=group(this.scene,0,1.5,0);box(this.base,0,.28,0,.9,.56,.9,orange);this.eye=group(this.base,1.65,1.48,.1);this.eye.add(this.camera);box(this.base,-.68,.55,-.15,.55,.18,.55,dark);box(this.base,-.68,.87,.62,.65,.19,.23,dark);this.main=group(this.base,0,.55,0);box(this.main,0,0,1.5,.3,.36,3,orange);this.outer=group(this.main,0,0,3);box(this.outer,0,0,1.05,.26,.28,2.1,orange);this.extension=group(this.outer,0,0,1.4);this.extensionBeam=box(this.extension,0,0,0,.17,.18,1,steel);this.tip=group(this.extension,0,0,1.3);this.claw=group(this.scene);this.rot=group(this.claw);box(this.rot,0,-.12,0,.39,.25,.39,dark);for(let i=0;i<6;i++){const radial=group(this.rot,0,-.24,0);radial.rotation.y=i*Math.PI/3;const jaw=group(radial,0,0,.14);beam(jaw,new T.Vector3(0,0,0),new T.Vector3(0,-.27,.28),.07,orange);beam(jaw,new T.Vector3(0,-.27,.28),new T.Vector3(0,-.65,.08),.065,orange);this.jaws.push(jaw);}
 for(const part of [this.main,this.outer,this.extension,this.rot]){
   for(const mesh of part.children){
     if(mesh instanceof T.Mesh)this.addCraneCollider(mesh);
   }
 }
 for(const jaw of this.jaws){
   for(const mesh of jaw.children){
     if(mesh instanceof T.Mesh)this.addCraneCollider(mesh);
   }
 }
 this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();const el=this.renderer.domElement;el.addEventListener('pointerdown',this.down);el.addEventListener('pointermove',this.move);el.addEventListener('pointerup',this.up);el.addEventListener('pointercancel',this.up);el.addEventListener('lostpointercapture',this.up);this.reset();this.frame=requestAnimationFrame(this.loop);}
 private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
 private down=(e:PointerEvent)=>{if(this.dragging!==null)return;this.dragging=e.pointerId;this.lastX=e.clientX;this.lastY=e.clientY;this.renderer.domElement.setPointerCapture(e.pointerId);};private move=(e:PointerEvent)=>{if(e.pointerId!==this.dragging)return;this.yaw=clamp(this.yaw-(e.clientX-this.lastX)*.005,-2.5,2.5);this.pitch=clamp(this.pitch-(e.clientY-this.lastY)*.005,-1.25,.55);this.lastX=e.clientX;this.lastY=e.clientY;};private up=(e:PointerEvent)=>{if(e.pointerId===this.dragging)this.dragging=null;};
 centerView(){this.yaw=.30;this.pitch=-.17;}
 reset(){this.angles=[0,deg(48),deg(-65),.6,0,1];this.rates.fill(0);this.inputs.fill(0);this.centerView();for(const w of this.waste){this.scene.remove(w.mesh);w.mesh.geometry.dispose();}this.waste=[];for(let i=0;i<12;i++){const mesh=box(this.scene,3.2+(i%4)*.65,.23,2.2+Math.floor(i/4)*.7,.43,.42,.56,i%3===0?steel:wood);mesh.rotation.y=i*.71;this.waste.push({
   mesh,halfSize:new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).multiplyScalar(.5),
   fallSpeed:0,held:false,loaded:false,offset:new T.Vector3()
 });}this.report(0);}
 private loop=(now:number)=>{const dt=Math.min((now-(this.last||now))/1000,.035);this.last=now;if(!this.paused)this.update(dt);this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.loop);};
 private update(dt:number){
   const speeds=[.65,.48,.65,1,1.4,1.5];
   const lo=[-deg(205),deg(5),deg(-140),0,-1e6,0];
   const hi=[deg(205),deg(80),deg(35),2.2,1e6,1];
   this.applyCranePose();
   for(let i=0;i<this.angles.length;i++){
     this.rates[i]+=(this.inputs[i]*speeds[i]-this.rates[i])*Math.min(1,dt*10);
     const previous=this.angles[i];
     const next=clamp(previous+this.rates[i]*dt,lo[i],hi[i]);
     if(next===previous)continue;
     this.angles[i]=next;
     this.applyCranePose();
     if(this.craneHitsObstacle()){
       this.angles[i]=previous;
       this.rates[i]=0;
       this.applyCranePose();
     }
   }
   this.camera.rotation.order='YXZ';
   this.camera.rotation.y=Math.PI+this.yaw;
   this.camera.rotation.x=this.pitch;
   this.updateWaste(this.claw.position.clone().add(new T.Vector3(0,-.62,0)),this.angles[5],dt);
 }

 private applyCranePose(){
 const [s,a,b,e,r,j]=this.angles;
 this.base.rotation.y=s;
 this.main.rotation.x=-a;
 this.outer.rotation.x=-b;
 this.extension.position.z=1.4+e;
 // Keep the rear of the telescoping beam inside the outer boom at full extension.
 const beamLength=1.55+e;
 this.extensionBeam.scale.z=beamLength;
 this.extensionBeam.position.z=1.3-beamLength/2;
 this.tip.getWorldPosition(this.claw.position);
 this.claw.rotation.y=s;
 this.rot.rotation.y=r;
 for(const jaw of this.jaws)jaw.rotation.x=-j*1.05+.30;
 this.claw.updateMatrixWorld(true);
 }

 private addCraneCollider(mesh:T.Mesh){
   mesh.geometry.computeBoundingBox();
   const local=new OBB().fromBox3(mesh.geometry.boundingBox!);
   // Leave a small contact tolerance around the visible geometry.
   local.halfSize.addScalar(-.004);
   this.craneColliders.push({mesh,local});
 }

 private craneHitsObstacle(){
   for(const {mesh,local} of this.craneColliders){
     mesh.updateWorldMatrix(true,false);
     this.worldCollider.copy(local).applyMatrix4(mesh.matrixWorld);
     if(this.obstacles.some(obstacle=>this.worldCollider.intersectsBox3(obstacle)))return true;
   }
   return false;
 }

 private addObstacle(x:number,y:number,z:number,w:number,h:number,d:number,material:T.Material){
   const mesh=box(this.scene,x,y,z,w,h,d,material);
   this.obstacles.push(new T.Box3().setFromObject(mesh));
 }

 private moveWaste(waste:Waste,axis:Axis,delta:number){
   const position=waste.mesh.position;
   const half=waste.halfSize;
   const destination=position[axis]+delta;
   let limit=destination;
   for(const obstacle of this.obstacles){
     limit=this.limitMovement(position,half,axis,delta,limit,obstacle.min,obstacle.max);
   }
   for(const other of this.waste){
     if(other===waste)continue;
     const min=other.mesh.position.clone().sub(other.halfSize);
     const max=other.mesh.position.clone().add(other.halfSize);
     limit=this.limitMovement(position,half,axis,delta,limit,min,max);
   }
   position[axis]=limit;
   return limit!==destination;
 }

 private limitMovement(position:T.Vector3,half:T.Vector3,axis:Axis,delta:number,limit:number,min:T.Vector3,max:T.Vector3){
   const tolerance=1e-6;
   for(const side of collisionAxes){
     if(side===axis)continue;
     if(position[side]+half[side]<=min[side]+tolerance || position[side]-half[side]>=max[side]-tolerance)return limit;
   }
   // Sweep to the nearest surface so fast movement also stops on contact.
   if(delta>0 && position[axis]+half[axis]<=min[axis]+tolerance){
     return Math.min(limit,Math.max(position[axis],min[axis]-half[axis]));
   }
   if(delta<0 && position[axis]-half[axis]>=max[axis]-tolerance){
     return Math.max(limit,Math.min(position[axis],max[axis]+half[axis]));
   }
   return limit;
 }

 private updateWaste(center:T.Vector3,opening:number,dt:number){
   let loaded=0;
   for(const waste of this.waste){
     const position=waste.mesh.position;
     if(waste.held && opening>.58)waste.held=false;
     if(!waste.held && !waste.loaded && opening<.32 && this.inputs[5]<0 && position.distanceTo(center)<.72){
       waste.held=true;
       waste.fallSpeed=0;
       waste.offset.copy(position).sub(center);
     }
     if(waste.held){
       const target=center.clone().add(waste.offset);
       for(const axis of collisionAxes)this.moveWaste(waste,axis,target[axis]-position[axis]);
       waste.held=position.distanceTo(target)<.72;
       waste.loaded=false;
     }else{
       waste.fallSpeed+=9.81*dt;
       const supported=this.moveWaste(waste,'y',-waste.fallSpeed*dt);
       if(supported)waste.fallSpeed=0;
       waste.loaded=supported && Math.abs(position.x)<1.17*truckWidthScale && position.z>truckZ(.955) && position.z<truckZ(5.845) &&
         position.y-waste.halfSize.y>=bedTop-1e-6;
     }
     if(waste.loaded)loaded++;
   }
   this.report(loaded);
 }
 dispose(){cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});this.renderer.dispose();this.renderer.domElement.remove();}
}
