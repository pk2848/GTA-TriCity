import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const DEFAULT_CAR_LIMIT=3, DEFAULT_PEDESTRIAN_LIMIT=8, JOIN_RADIUS=19;
const DEFAULT_TRAFFIC_IDS=['pagani-zonda-cinque','dodge-charger-1970','dodge-challenger-2015'];
// Use one shared uploaded girl-character model for a subset of ambient pedestrians.
// It is loaded once and cloned with shared geometry/materials to keep GPU memory bounded.
const GIRL_PEDESTRIAN_URL = new URL('../charachter/mita_ashley_-_anime_girl_-_3d_stylized_tpose.glb', import.meta.url).href;
const GIRL_PEDESTRIAN_TARGET_HEIGHT = 1.66;
const CAR_COLORS=[0xb83f35,0xd5d8d5,0x243f68,0x87877f,0x252b2e,0xc5a45d,0x557353,0x814c73,0x4d7788];
const PEOPLE_COLORS=[0x315f91,0x8d493e,0x536846,0xb18a45,0x55515f,0x8b6b58,0x3e7774,0x9b6d8c];
const shared={
 tire:new THREE.MeshStandardMaterial({color:0x17191b,roughness:.94}),
 glass:new THREE.MeshStandardMaterial({color:0x182d38,roughness:.25,metalness:.12}),
 trim:new THREE.MeshStandardMaterial({color:0x252b2d,roughness:.68}),
 chrome:new THREE.MeshStandardMaterial({color:0x9ba5a2,metalness:.72,roughness:.26}),
 skin:new THREE.MeshStandardMaterial({color:0xb98c70,roughness:.95}),
 trousers:new THREE.MeshStandardMaterial({color:0x26323c,roughness:1}),
 shoe:new THREE.MeshStandardMaterial({color:0x1c2023,roughness:.95}),
 redOff:new THREE.MeshStandardMaterial({color:0x501b17,emissive:0x160302}),
 amberOff:new THREE.MeshStandardMaterial({color:0x59401a,emissive:0x140b01}),
 greenOff:new THREE.MeshStandardMaterial({color:0x17462b,emissive:0x021408}),
 redOn:new THREE.MeshStandardMaterial({color:0xff493e,emissive:0xff1200,emissiveIntensity:2.2}),
 amberOn:new THREE.MeshStandardMaterial({color:0xffc34c,emissive:0xff9d00,emissiveIntensity:1.9}),
 greenOn:new THREE.MeshStandardMaterial({color:0x52e58d,emissive:0x00e65b,emissiveIntensity:2.1})
};
function box(parent,w,h,d,material,x,y,z){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function dist(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}
function lengthOf(points){let n=0;for(let i=1;i<points.length;i++)n+=dist(points[i-1],points[i]);return n;}
function offsetPath(points,offset){
 return points.map((p,i)=>{
  const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
  let dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;
  return {x:p.x-dz*offset,z:p.z+dx*offset};
 });
}
function samplePath(points,distance){
 let left=Math.max(0,distance);
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);
  if(l<.01)continue;
  if(left<=l||i===points.length-2){const t=THREE.MathUtils.clamp(left/l,0,1);return{x:THREE.MathUtils.lerp(a.x,b.x,t),z:THREE.MathUtils.lerp(a.z,b.z,t),heading:Math.atan2(-dx,-dz)};}
  left-=l;
 }
 const p=points[points.length-1]||{x:0,z:0};return{x:p.x,z:p.z,heading:0};
}
function project(p,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1;
 const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l2,0,1),q={x:a.x+t*dx,z:a.z+t*dz};
 const l=Math.sqrt(l2);return{point:q,distance:dist(p,q),tangent:{x:dx/l,z:dz/l}};
}
function nearestRoad(point,roads,max=32){
 let best=null;
 for(const road of roads.values())for(let i=0;i<road.points.length-1;i++){
  const q=project(point,road.points[i],road.points[i+1]);
  if(q.distance<max&&(!best||q.distance<best.distance))best={road,...q};
 }
 return best;
}
function makePedestrian(color,variant=0){
 const g=new THREE.Group();g.name='pedestrian-character';
 const isWoman=variant%2===1;
 const shirt=new THREE.MeshStandardMaterial({color,roughness:.95});
 const torso=new THREE.Mesh(new THREE.CapsuleGeometry(isWoman ? 0.19 : 0.22,.58,4,8),shirt);torso.position.y=1.1;g.add(torso);
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.15,7),shared.skin);neck.position.y=1.55;g.add(neck);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.19,12,10),shared.skin);head.position.y=1.72;g.add(head);
 const hairMaterial=new THREE.MeshStandardMaterial({color:variant%3===0?0x211b18:0x392a22,roughness:1});
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.194,10,7,0,Math.PI*2,0,Math.PI*.52),hairMaterial);hair.position.y=1.79;g.add(hair);
 if(isWoman){
  const backHair=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.28,3,7),hairMaterial);backHair.position.set(0,1.58,.1);g.add(backHair);
  const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.13,.24,.42,9),shirt);skirt.position.y=.82;g.add(skirt);
 }
 const arms=[];
 for(const x of [isWoman ? -.245 : -.27,isWoman ? 0.245 : 0.27]){
  const pivot=new THREE.Group();pivot.position.set(x,1.34,0);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.065,.075,.56,7),shared.skin);arm.position.y=-.27;pivot.add(arm);g.add(pivot);arms.push(pivot);
 }
 const legs=[];
 for(const x of [-.12,.12]){
  const pivot=new THREE.Group();pivot.position.set(x,.76,0);
  const leg=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.72,7),shared.trousers);leg.position.y=-.36;pivot.add(leg);
  const shoe=new THREE.Mesh(new THREE.BoxGeometry(.17,.1,.3),shared.shoe);shoe.position.set(0,-.7,-.05);pivot.add(shoe);g.add(pivot);legs.push(pivot);
 }
 if(variant%4===0)box(g,.34,.42,.18,shared.trim,.3,1.12,.12);
 g.userData.limbs={arms,legs};g.userData.gender=isWoman?'woman':'man';
 g.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
 return g;
}
function createSignal(scene,feature,index){
 const g=new THREE.Group();g.name='traffic-signal';g.position.set(feature.x,0,feature.z);
 const poleMat=new THREE.MeshStandardMaterial({color:0x4a5552,metalness:.62,roughness:.38});
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.075,.095,5.2,8),poleMat);pole.position.y=2.6;pole.castShadow=true;pole.receiveShadow=true;g.add(pole);
 box(g,.52,1.45,.36,new THREE.MeshStandardMaterial({color:0x17201e}),.23,4.3,0);
 const ys=[4.78,4.31,3.84],off=[shared.redOff,shared.amberOff,shared.greenOff],bulbs=[];
 for(let i=0;i<3;i++){const bulb=new THREE.Mesh(new THREE.SphereGeometry(.155,10,8),off[i]);bulb.position.set(.23,ys[i],-.192);bulb.castShadow=true;bulb.receiveShadow=true;g.add(bulb);bulbs.push(bulb);}
 box(g,1.3,.09,.09,poleMat,-.47,4.95,0);
 scene.add(g);return{group:g,bulbs,axis:feature.axis||{x:1,z:0},phaseOffset:(index%2)*12,feature,phase:''};
}
function updateSignal(signal,time){
 const p=(time+signal.phaseOffset)%24,state=p<9?'green':p<12?'amber':p<21?'red':'amber';
 if(state===signal.phase)return;signal.phase=state;
 const idx=state==='green'?2:state==='amber'?1:0,off=[shared.redOff,shared.amberOff,shared.greenOff],on=[shared.redOn,shared.amberOn,shared.greenOn];
 signal.bulbs.forEach((bulb,i)=>{bulb.material=i===idx?on[i]:off[i];});
}

export class TrafficSystem{
 constructor(scene,onCounts=()=>{},onEvent=()=>{}){
  this.scene=scene;this.onCounts=onCounts;this.onEvent=onEvent;
  this.registeredTiles=new Set();this.roads=new Map();this.cars=[];this.pedestrians=[];this.crossings=[];this.signals=[];this.elapsed=0;this.populationRefreshElapsed=0;this.crossingObjects=[];
  this.maxCars=DEFAULT_CAR_LIMIT;this.maxPedestrians=DEFAULT_PEDESTRIAN_LIMIT;
  this.vehicleProfiles=[];this.vehicleTemplates=new Map();this.vehicleTemplateErrors=[];
  this.vehicleLoader=new GLTFLoader();
  this.trafficVehicleIds=[...DEFAULT_TRAFFIC_IDS];
  this.pedestrianLoader=new GLTFLoader();
  this.girlPedestrianTemplate=null;this.girlPedestrianAnimations=[];this.girlPedestrianAssigned=false;
  this.girlPedestrianLoading=false;this.girlPedestrianError=null;
  this.loadUploadedTrafficVehicles();
  this.onCounts({cars:0,pedestrians:0,signals:0,crossings:0});
 }

 setQuality({cars=this.maxCars,pedestrians=this.maxPedestrians}={}){
  this.maxCars=Math.max(0,Math.floor(cars));
  this.maxPedestrians=Math.max(0,Math.floor(pedestrians));
  while(this.cars.length>this.maxCars){
   const car=this.cars.pop();
   this.scene.remove(car.object);
   car.object.clear();
  }
  while(this.pedestrians.length>this.maxPedestrians){
   const person=this.pedestrians.pop();
   this.scene.remove(person.object);
   person.mixer?.stopAllAction();
   // GLB clones share immutable geometry/materials with the single loaded template.
   // Never dispose those shared resources while removing an individual NPC.
   if(!person.isUploadedGirl)person.object.traverse(object=>{if(object.geometry)object.geometry.dispose();});
   person.object.clear();
  }
  // If the user raises the density preset, fill the new allowance from roads
  // already streamed into the current neighborhood.
  for(const road of this.roads.values()){
   if(this.cars.length>=this.maxCars&&this.pedestrians.length>=this.maxPedestrians)break;
   this.spawnRoadTraffic(road);
  }
  this.emitCounts();
 }

 async loadGirlPedestrianModel(){
  if(this.girlPedestrianLoading||this.girlPedestrianTemplate)return;
  this.girlPedestrianLoading=true;
  try{
   console.info('[GTA-TriCity] Loading uploaded ambient girl character…');
   const gltf=await this.pedestrianLoader.loadAsync(GIRL_PEDESTRIAN_URL);
   const source=gltf.scene;
   source.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(source);
   if(bounds.isEmpty())throw new Error('Girl character GLB has no visible geometry');
   const size=bounds.getSize(new THREE.Vector3());
   if(size.y<0.2)throw new Error(`Expected a Y-up character model; height was ${size.y.toFixed(2)}`);
   const scale=GIRL_PEDESTRIAN_TARGET_HEIGHT/size.y;
   const center=bounds.getCenter(new THREE.Vector3());
   const normalized=new THREE.Group();
   normalized.name='uploaded-girl-pedestrian-template';
   normalized.scale.setScalar(scale);
   normalized.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);
   // Most glTF character exports face +Z; this makes the model face the game's -Z forward axis.
   const facing=new THREE.Group();
   facing.name='girl-character-forward-correction';
   facing.rotation.y=Math.PI;
   facing.add(source);
   normalized.add(facing);
   normalized.traverse(object=>{
    if(!object.isMesh)return;
    object.castShadow=true;
    object.receiveShadow=true;
    object.frustumCulled=true;
   });
   normalized.updateMatrixWorld(true);
   this.girlPedestrianTemplate=normalized;
   this.girlPedestrianAnimations=gltf.animations||[];
   let replaced=0;
   // One detailed uploaded NPC is enough to make the character recognizable.
   // Other pedestrians stay lightweight to avoid hundreds of extra draw calls.
   const firstAvailable=this.pedestrians.find(person=>person.gender==='woman'&&!person.isUploadedGirl);
   if(firstAvailable&&this.replacePedestrianWithGirl(firstAvailable))replaced=1;
   console.info(`[GTA-TriCity] Uploaded girl pedestrian ready · ${replaced} detailed roaming NPC · ${this.girlPedestrianAnimations.length} animation clips`);
  }catch(error){
   this.girlPedestrianError=error;
   console.warn('[GTA-TriCity] Girl pedestrian GLB could not be loaded; keeping existing pedestrians.',error);
  }finally{
   this.girlPedestrianLoading=false;
  }
 }

 createGirlWalkRig(root){
  const rig={leftLeg:[],rightLeg:[],leftArm:[],rightArm:[]};
  root.traverse(object=>{
   if(!object.isBone)return;
   const n=object.name.toLowerCase().replace(/[^a-z0-9]/g,'');
   const entry={bone:object,base:object.quaternion.clone()};
   if(/left.*(upleg|thigh|upperleg)|(^|mixamorig)leftupleg/.test(n))rig.leftLeg.push(entry);
   else if(/right.*(upleg|thigh|upperleg)|(^|mixamorig)rightupleg/.test(n))rig.rightLeg.push(entry);
   else if(/left.*(arm|shoulder)|leftarm/.test(n))rig.leftArm.push(entry);
   else if(/right.*(arm|shoulder)|rightarm/.test(n))rig.rightArm.push(entry);
  });
  return rig;
 }

 replacePedestrianWithGirl(person){
  if(!this.girlPedestrianTemplate||!person||person.isUploadedGirl)return false;
  const previous=person.object;
  const position=previous.position.clone();
  const rotation=previous.rotation.clone();
  const clone=SkeletonUtils.clone(this.girlPedestrianTemplate);
  clone.position.copy(position);
  clone.rotation.copy(rotation);
  clone.traverse(object=>{
   if(!object.isMesh)return;
   object.castShadow=true;object.receiveShadow=true;object.frustumCulled=true;
  });
  const mixer=new THREE.AnimationMixer(clone);
  const clips=this.girlPedestrianAnimations;
  const walkClip=clips.find(clip=>/walk|walking|run/i.test(clip.name))||null;
  if(walkClip)mixer.clipAction(walkClip).play();
  this.scene.add(clone);
  this.scene.remove(previous);
  person.object=clone;
  person.mixer=mixer;
  person.hasWalkAnimation=Boolean(walkClip);
  person.walkRig=this.createGirlWalkRig(clone);
  person.isUploadedGirl=true;
  this.girlPedestrianAssigned=true;
  person.object.userData.isUploadedGirl=true;
  return true;
 }

 updateGirlWalkAnimation(person,dt,stride){
  if(person.mixer&&person.hasWalkAnimation){
   person.mixer.update(dt);
   return;
  }
  const rig=person.walkRig;
  if(!rig)return;
  const apply=(entries,angle)=>{
   for(const item of entries){
    item.bone.quaternion.copy(item.base);
    item.bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),angle));
   }
  };
  apply(rig.leftLeg,stride);
  apply(rig.rightLeg,-stride);
  apply(rig.leftArm,-stride*.55);
  apply(rig.rightArm,stride*.55);
 }

 async loadUploadedTrafficVehicles(){
  const base=import.meta.env.BASE_URL||'/';
  try{
   const response=await fetch(`${base}models/vehicles/manifest.json`,{cache:'no-store'});
   if(!response.ok)throw new Error(`Vehicle manifest HTTP ${response.status}`);
   const manifest=await response.json();
   this.vehicleProfiles=Array.isArray(manifest.vehicles)?manifest.vehicles:[];
   // Ambient road traffic uses uploaded cars only. Two-wheelers are player-selectable
   // until a separate motorcycle + rider physics/animation system is implemented.
   const trafficProfiles=this.vehicleProfiles.filter(profile =>
    profile.physics?.vehicleType !== 'motorcycle' &&
    profile.physics?.vehicleType !== 'helicopter' &&
    profile.physics?.vehicleType !== 'boat' &&
    profile.trafficEnabled !== false
   );
   this.trafficVehicleIds=trafficProfiles.map(profile=>profile.id).filter(Boolean);

   for(const profile of trafficProfiles){
    const file=String(profile.file||'').split('/').pop();
    if(!file||!file.toLowerCase().endsWith('.glb'))continue;
    try{
     const gltf=await this.vehicleLoader.loadAsync(`${base}models/vehicles/${file}`);
     const rotation=Array.isArray(profile.rotation)?profile.rotation:[0,0,0];
     const sourceRoot=new THREE.Group();
     sourceRoot.rotation.set(Number(rotation[0])||0,Number(rotation[1])||0,Number(rotation[2])||0);
     sourceRoot.scale.setScalar(Number(profile.scale)||1);
     sourceRoot.add(gltf.scene);
     sourceRoot.updateMatrixWorld(true);
     const inverseRoot=new THREE.Matrix4().copy(sourceRoot.matrixWorld).invert();
     const buckets=new Map();
     const looseMeshes=[];
     const originalGeometries=new Set();

     // Merge same-material geometry into a few meshes. This is important for the
     // 2015 Challenger GLB, which contains more than 1,400 separate mesh nodes.
     gltf.scene.traverse(object=>{
      if(!object.isMesh||!object.geometry||!object.material)return;
      originalGeometries.add(object.geometry);
      const relativeMatrix=new THREE.Matrix4().multiplyMatrices(inverseRoot,object.matrixWorld);
      const geometry=object.geometry.clone();
      geometry.applyMatrix4(relativeMatrix);

      if(Array.isArray(object.material)){
       looseMeshes.push({geometry,material:object.material});
       return;
      }
      const key=object.material.uuid;
      if(!buckets.has(key))buckets.set(key,{material:object.material,geometries:[]});
      buckets.get(key).geometries.push(geometry);
     });

     const mergedRoot=new THREE.Group();
     for(const {material,geometries} of buckets.values()){
      let merged=null;
      try{merged=mergeGeometries(geometries,false);}catch(error){console.warn('[GTA-TriCity] Traffic mesh merge fallback',profile.id,error);}
      if(merged){
       const mesh=new THREE.Mesh(merged,material);
       mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
       mergedRoot.add(mesh);
       geometries.forEach(geometry=>geometry.dispose());
      }else{
       geometries.forEach(geometry=>{
        const mesh=new THREE.Mesh(geometry,material);
        mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
        mergedRoot.add(mesh);
       });
      }
     }
     for(const item of looseMeshes){
      const mesh=new THREE.Mesh(item.geometry,item.material);
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=true;
      mergedRoot.add(mesh);
     }
     originalGeometries.forEach(geometry=>geometry.dispose());

     const model=new THREE.Group();
     model.name=`traffic-template-${profile.id}`;
     model.rotation.set(Number(rotation[0])||0,Number(rotation[1])||0,Number(rotation[2])||0);
     model.scale.setScalar(Number(profile.scale)||1);
     model.add(mergedRoot);
     model.updateMatrixWorld(true);
     let bounds=new THREE.Box3().setFromObject(model);
     if(bounds.isEmpty())throw new Error('GLB has no visible mesh geometry');
     const size=bounds.getSize(new THREE.Vector3());
     const targetWidth=Number(profile.physics?.width)||size.x;
     const targetLength=Number(profile.physics?.length)||size.z;
     const fit=Math.min(targetWidth/Math.max(size.x,.001),targetLength/Math.max(size.z,.001));
     model.scale.multiplyScalar(fit);
     model.updateMatrixWorld(true);
     bounds=new THREE.Box3().setFromObject(model);
     const center=bounds.getCenter(new THREE.Vector3());
     model.position.set(-center.x,-bounds.min.y,-center.z);
     this.vehicleTemplates.set(profile.id,model);

     // Replace waiting agent groups after the shared model template becomes available.
     for(const car of this.cars)if(car.modelId===profile.id)this.attachTrafficModel(car);
    }catch(error){
     this.vehicleTemplateErrors.push({id:profile.id,error});
     console.warn('[GTA-TriCity] Traffic GLB failed to load:',profile.file,error);
    }
   }
   this.emitCounts();
  }catch(error){
   console.error('[GTA-TriCity] Uploaded traffic manifest failed:',error);
   this.vehicleTemplateErrors.push({id:'manifest',error});
  }
 }

 attachTrafficModel(car){
  const template=this.vehicleTemplates.get(car.modelId);
  if(!template||!car.object)return false;
  car.object.clear();
  car.object.add(template.clone(true));
  car.object.visible=true;
  car.object.userData.vehicleModelId=car.modelId;
  return true;
 }
 addRoads(roads,tileKey,features=[]){
  this.registeredTiles.add(tileKey);
  for(const road of roads||[]){
   const id=String(road.id),points=road.points||[],length=lengthOf(points);
   if(this.roads.has(id)||points.length<2||length<70)continue;
   const record={...road,id,tileKey,points,length,width:Number(road.width)||5.2,oneway:Boolean(road.oneway),type:road.type||'residential'};
   this.roads.set(id,record);this.spawnRoadTraffic(record);
  }
  this.addFeatures(features);this.emitCounts();
 }
 spawnRoadTraffic(road,{pedestriansOnly=false}={}){
  const drivable=!['footway','path','pedestrian','cycleway','steps','track'].includes(road.type);
  const urban=['primary','secondary','tertiary','unclassified','residential','living_street','service'].includes(road.type);
  const tileCars=this.cars.filter(car=>car.tileKey===road.tileKey).length;
  const tilePeople=this.pedestrians.filter(person=>person.tileKey===road.tileKey).length;
  const maxTileCars=Math.max(1,Math.ceil(this.maxCars/9));
  const maxTilePeople=Math.max(2,Math.ceil(this.maxPedestrians/9));
  if(!pedestriansOnly&&drivable&&this.cars.length<this.maxCars&&tileCars<maxTileCars){
   const dirs=road.oneway?[1]:[1,-1];
   for(const direction of dirs){
    if(this.cars.length>=this.maxCars||this.cars.filter(car=>car.tileKey===road.tileKey).length>=maxTileCars)break;
    const base=direction===1?road.points:[...road.points].reverse(),points=offsetPath(base,-road.width*.16),length=lengthOf(points);
    if(length<45)continue;
    const ids=this.trafficVehicleIds.length?this.trafficVehicleIds:DEFAULT_TRAFFIC_IDS;
    const modelId=ids[Math.floor(Math.random()*ids.length)];
    const object=new THREE.Group();object.name=`traffic-${modelId}`;object.visible=false;
    const progress=Math.random()*Math.max(2,length-16);
    const agent={object,modelId,roadId:road.id,tileKey:road.tileKey,points,length,progress,direction,speed:4.2+Math.random()*3.6,targetSpeed:5.8+Math.random()*4.5,collisionCooldown:0,oneway:road.oneway,respawnTimer:0,pauseTimer:0};
    const p=samplePath(points,progress);object.position.set(p.x,0,p.z);object.rotation.y=p.heading;this.scene.add(object);this.attachTrafficModel(agent);this.cars.push(agent);
   }
  }
  if(urban&&this.pedestrians.length<this.maxPedestrians&&tilePeople<maxTilePeople){
   for(const side of [-1,1]){
    if(this.pedestrians.length>=this.maxPedestrians||this.pedestrians.filter(person=>person.tileKey===road.tileKey).length>=maxTilePeople)break;
    const path=offsetPath(road.points,side*(road.width/2+1.8)),length=lengthOf(path);if(length<80)continue;
    const personIndex=this.pedestrians.length;
    const object=makePedestrian(PEOPLE_COLORS[Math.floor(Math.random()*PEOPLE_COLORS.length)],personIndex),progress=Math.random()*length;
    const person={object,gender:object.userData.gender,tileKey:road.tileKey,points:path,length,progress,speed:.72+Math.random()*.58,phase:Math.random()*Math.PI*2,fallen:false,fallTimer:0,collisionCooldown:0,direction:1,crossing:false,wait:0,mixer:null,hasWalkAnimation:false,walkRig:null,isUploadedGirl:false};
    const p=samplePath(path,progress);object.position.set(p.x,0,p.z);object.rotation.y=p.heading;this.scene.add(object);this.pedestrians.push(person);
    // Defer the 64 MB character download until the first OSM pedestrian actually spawns.
    if(personIndex===0&&!this.girlPedestrianTemplate&&!this.girlPedestrianLoading)this.loadGirlPedestrianModel();
    if(!this.girlPedestrianAssigned&&this.girlPedestrianTemplate)this.replacePedestrianWithGirl(person);
   }
  }
 }
 chooseContinuation(car,endpoint,heading){
  const options=[];
  for(const road of this.roads.values()){
   if(road.id===car.roadId||road.length<25)continue;
   const first=road.points[0],last=road.points[road.points.length-1];
   if(dist(endpoint,first)<=JOIN_RADIUS){
    const next=road.points[1],l=dist(next,first)||1,dir={x:(next.x-first.x)/l,z:(next.z-first.z)/l};
    options.push({road,direction:1,score:dir.x*heading.x+dir.z*heading.z});
   }
   if(!road.oneway&&dist(endpoint,last)<=JOIN_RADIUS){
    const next=road.points[road.points.length-2],l=dist(next,last)||1,dir={x:(next.x-last.x)/l,z:(next.z-last.z)/l};
    options.push({road,direction:-1,score:dir.x*heading.x+dir.z*heading.z});
   }
  }
  if(!options.length)return null;options.sort((a,b)=>b.score-a.score);
  return options[Math.floor(Math.random()*Math.min(3,options.length))];
 }
 addFeatures(features){
  for(const feature of features||[]){
   if(feature.type==='signal'&&!this.signals.some(s=>s.feature.id===feature.id)){
    const road=nearestRoad(feature,this.roads,35),axis=road?road.tangent:{x:1,z:0};
    this.signals.push(createSignal(this.scene,{...feature,axis},this.signals.length));
   }
   if(feature.type==='crossing'&&!this.crossings.some(c=>c.id===feature.id)){
    const road=nearestRoad(feature,this.roads,28);if(road)this.createCrossing(feature,road);
   }
  }
 }
 createCrossing(feature,near){
  const p={x:feature.x,z:feature.z},t=near.tangent,n={x:-t.z,z:t.x},half=near.road.width/2+2.1;
  const start={x:p.x+n.x*half,z:p.z+n.z*half},end={x:p.x-n.x*half,z:p.z-n.z*half};
  const group=new THREE.Group();group.name='osm-zebra-crossing';
  const mat=new THREE.MeshStandardMaterial({color:0xe4e6df,roughness:.95});
  for(let i=-3;i<=3;i++){
   const stripe=new THREE.Mesh(new THREE.BoxGeometry(.62,.055,near.road.width+3.2),mat);
   stripe.position.set(p.x+t.x*i*.95,.12,p.z+t.z*i*.95);stripe.rotation.y=Math.atan2(-n.z,n.x);stripe.castShadow=true;stripe.receiveShadow=true;group.add(stripe);
  }
  this.scene.add(group);this.crossingObjects.push(group);
  for(let i=0;i<2&&this.pedestrians.length<this.maxPedestrians;i++){
   const a=i===0?start:end,b=i===0?end:start,object=makePedestrian(PEOPLE_COLORS[(i+3)%PEOPLE_COLORS.length],i+3);
   const points=[a,b],length=dist(a,b),progress=Math.random()*length;
   const person={object,gender:object.userData.gender,points,length,progress,speed:.85+Math.random()*.35,phase:Math.random()*6,fallen:false,fallTimer:0,collisionCooldown:0,direction:1,crossing:true,wait:Math.random()*8,crossingPoint:p,crossingAxis:t};
   const q=samplePath(points,progress);object.position.set(q.x,0,q.z);object.rotation.y=q.heading;this.scene.add(object);this.pedestrians.push(person);
  }
  this.crossings.push({id:feature.id,point:p,start,end,road:near.road});
 }
 signalState(heading,signal){
  const alignment=Math.abs(heading.x*signal.axis.x+heading.z*signal.axis.z),phase=(this.elapsed+signal.phaseOffset)%24;
  const groupA=alignment>=.72,go=groupA?phase<9:phase>=12&&phase<21,amber=groupA?(phase>=9&&phase<12):phase>=21;
  return go?'green':amber?'amber':'red';
 }
 nearestSignal(point,heading){
  let best=null,min=22;
  for(const signal of this.signals){const d=dist(point,signal.feature);if(d<min){min=d;best={signal,distance:d,state:this.signalState(heading,signal)};}}
  return best;
 }
 update(dt,player){
  this.elapsed+=dt;this.populationRefreshElapsed+=dt;const events=[];this.signals.forEach(s=>updateSignal(s,this.elapsed));
  if(this.populationRefreshElapsed>=2.5){
   this.populationRefreshElapsed=0;
   for(let i=this.pedestrians.length-1;i>=0;i--){
    const person=this.pedestrians[i];
    if(dist(player,person.object.position)<=950)continue;
    this.scene.remove(person.object);person.mixer?.stopAllAction();
    if(!person.isUploadedGirl)person.object.traverse(object=>{if(object.geometry)object.geometry.dispose();});
    person.object.clear();this.pedestrians.splice(i,1);
   }
   if(this.pedestrians.length<this.maxPedestrians){
    const nearbyRoads=[...this.roads.values()].filter(road=>
     ['primary','secondary','tertiary','unclassified','residential','living_street','service'].includes(road.type)
    ).map(road=>{
     const middle=road.points[Math.floor(road.points.length/2)]||road.points[0];
     return{road,distance:Math.min(dist(player,road.points[0]),dist(player,middle),dist(player,road.points[road.points.length-1]))};
    }).filter(entry=>entry.distance<700).sort((a,b)=>a.distance-b.distance);
    for(const entry of nearbyRoads){
     if(this.pedestrians.length>=this.maxPedestrians)break;
     this.spawnRoadTraffic(entry.road,{pedestriansOnly:true});
    }
   }
  }
  for(const car of this.cars){
   car.collisionCooldown=Math.max(0,car.collisionCooldown-dt);
   if(car.respawnTimer>0){car.respawnTimer-=dt;if(car.respawnTimer<=0){car.object.visible=true;car.speed=3.5;car.targetSpeed=6;car.progress=0;}else continue;}
   if(car.pauseTimer>0){car.pauseTimer-=dt;car.speed=Math.max(0,car.speed-dt*5);}
   const current=samplePath(car.points,car.progress),remaining=car.length-car.progress;
   const heading={x:-Math.sin(current.heading),z:-Math.cos(current.heading)},signal=this.nearestSignal(current,heading);
   const toSignal=signal?{x:signal.signal.feature.x-current.x,z:signal.signal.feature.z-current.z}:null;
   const signalAhead=Boolean(toSignal&&(toSignal.x*heading.x+toSignal.z*heading.z)>-1.5);
   const stop=signal&&signal.distance<18&&signal.state==='red'&&signalAhead&&remaining>2;
   const target=stop||car.pauseTimer>0?0:car.targetSpeed;
   car.speed+=(target-car.speed)*Math.min(1,dt*(stop?3.2:.65));
   if(!stop&&car.pauseTimer<=0)car.speed=THREE.MathUtils.clamp(car.speed,2.5,10.5);
   car.progress+=car.speed*dt;
   if(car.progress>=car.length){
    const last=car.points[car.points.length-1],prev=car.points[car.points.length-2],l=dist(last,prev)||1,heading2={x:(last.x-prev.x)/l,z:(last.z-prev.z)/l};
    const next=this.chooseContinuation(car,last,heading2);
    if(next){
     car.roadId=next.road.id;car.direction=next.direction;car.oneway=next.road.oneway;
     const base=next.direction===1?next.road.points:[...next.road.points].reverse();
     car.points=offsetPath(base,-next.road.width*.16);car.length=lengthOf(car.points);car.progress=0;
    }else if(car.oneway){
     car.object.visible=false;car.respawnTimer=2.8;car.progress=0;continue;
    }else{
     const road=this.roads.get(car.roadId);car.direction*=-1;car.points=offsetPath(car.direction===1?road.points:[...road.points].reverse(),-road.width*.16);car.progress=0;
    }
   }
   const q=samplePath(car.points,Math.min(car.progress,car.length));car.object.position.set(q.x,0,q.z);car.object.rotation.y=q.heading;
   const d=dist(player,q);
   car.object.visible=d<320;
   if(d<3.1&&Math.abs(player.speed)>2&&car.collisionCooldown<=0){
    car.collisionCooldown=2.6;car.speed=0;car.targetSpeed=0;car.pauseTimer=2.2;
    events.push({type:'vehicle',impact:THREE.MathUtils.clamp(Math.abs(player.speed)/28,.25,1),agent:car});
   }
  }
  for(const person of this.pedestrians){
   person.collisionCooldown=Math.max(0,person.collisionCooldown-dt);
   if(person.fallen){
    person.fallTimer-=dt;person.object.rotation.z=THREE.MathUtils.lerp(person.object.rotation.z,Math.PI/2,Math.min(1,dt*5));person.object.position.y=Math.max(0,.06+Math.sin(this.elapsed*8)*.02);
    if(person.fallTimer<=0){person.fallen=false;person.object.rotation.z=0;person.object.position.y=0;person.collisionCooldown=2.5;}
    continue;
   }
   if(person.crossing){
    person.wait=Math.max(0,person.wait-dt);
    const crossingSignal=this.nearestSignal(person.crossingPoint,person.crossingAxis);
    const pedestrianGreen=!crossingSignal||crossingSignal.state==='red';
    if(person.wait===0&&pedestrianGreen){
     person.progress+=person.speed*person.direction*dt;
     if(person.progress>=person.length){person.progress=person.length;person.direction=-1;person.wait=4+Math.random()*8;}
     if(person.progress<=0){person.progress=0;person.direction=1;person.wait=4+Math.random()*8;}
    }else if(person.wait===0&&!pedestrianGreen){
     person.wait=.25;
    }
   }else{
    person.progress+=person.speed*person.direction*dt;
    if(person.progress>=person.length){person.direction=-1;person.progress=person.length;}
    if(person.progress<=0){person.direction=1;person.progress=0;}
   }
   const q=samplePath(person.points,person.progress);person.object.position.set(q.x,0,q.z);person.object.rotation.y=q.heading+(person.direction<0?Math.PI:0);
   const d=dist(player,q);
   person.object.visible=d<150;
   if(d>=150)continue;
   const limbs=person.object.userData.limbs,stride=(!person.crossing||person.wait===0)?Math.sin(this.elapsed*7*person.speed+person.phase)*.42:0;
   if(person.isUploadedGirl){
    this.updateGirlWalkAnimation(person,dt,stride);
    person.object.position.y=.015+Math.abs(stride)*.018;
   }else if(limbs){
    limbs.legs[0].rotation.x=stride;limbs.legs[1].rotation.x=-stride;limbs.arms[0].rotation.x=-stride*.65;limbs.arms[1].rotation.x=stride*.65;
   }
   if(d<2.35&&Math.abs(player.speed)>2.5&&person.collisionCooldown<=0){
    person.fallen=true;person.fallTimer=3.2;person.collisionCooldown=8;person.object.rotation.z=(Math.random()>.5?1:-1)*.24;
    events.push({type:'pedestrian',impact:THREE.MathUtils.clamp(Math.abs(player.speed)/24,.18,.78),agent:person});
   }
  }
  events.forEach(event=>this.onEvent(event));return events;
 }
 getCounts(){return{cars:this.cars.length,pedestrians:this.pedestrians.length,signals:this.signals.length,crossings:this.crossings.length};}
 emitCounts(){this.onCounts(this.getCounts());}
 dispose(){
  [...this.cars.map(a=>a.object),...this.pedestrians.map(a=>a.object),...this.crossingObjects,...this.signals.map(s=>s.group)].forEach(o=>this.scene.remove(o));
  this.pedestrians.forEach(person=>person.mixer?.stopAllAction());
  this.cars.length=0;this.pedestrians.length=0;this.crossings.length=0;this.signals.length=0;this.crossingObjects.length=0;this.roads.clear();this.registeredTiles.clear();this.emitCounts();
 }
}
