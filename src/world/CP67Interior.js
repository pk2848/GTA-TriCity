import * as THREE from 'three';

// CP67 interior reconstruction: room ordering follows the published CP67 first-floor
// general arrangement and public atrium/PVR photographs. Exact tenant boundaries can vary.
const FLOOR_HEIGHT = 4.6;
const FLOOR_COUNT = 4;

const MAT = {
  marble: new THREE.MeshStandardMaterial({ color: 0xc9c7c0, roughness: 0.24, metalness: 0.04 }),
  marbleDark: new THREE.MeshStandardMaterial({ color: 0x777a7a, roughness: 0.32, metalness: 0.08 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xe4e1d8, roughness: 0.78 }),
  wallWarm: new THREE.MeshStandardMaterial({ color: 0xcabda9, roughness: 0.76 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.82 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9db8bd, roughness: 0.12, metalness: 0.12, transmission: 0.18, transparent: true, opacity: 0.42 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x8e9a9a, metalness: 0.78, roughness: 0.2 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x30383b, metalness: 0.68, roughness: 0.32 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x70503a, roughness: 0.54 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xb28b62, roughness: 0.54 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xb79859, metalness: 0.72, roughness: 0.26 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x151d22, roughness: 0.86 }),
  screen: new THREE.MeshBasicMaterial({ color: 0x070b11 }),
  plant: new THREE.MeshStandardMaterial({ color: 0x356b42, roughness: 1 }),
  plantLight: new THREE.MeshStandardMaterial({ color: 0x67905c, roughness: 1 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x514634, roughness: 1 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x727d80, metalness: 0.8, roughness: 0.24 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x8b302c, roughness: 0.76 }),
  seatDark: new THREE.MeshStandardMaterial({ color: 0x303c48, roughness: 0.85 }),
  cafe: new THREE.MeshStandardMaterial({ color: 0x7c523b, roughness: 0.72 }),
  black: new THREE.MeshStandardMaterial({ color: 0x080b0e, roughness: 0.92 })
};

function box(parent,w,h,d,material,x,y,z,name='') {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if(name) mesh.name = name;
  parent.add(mesh);
  return mesh;
}
function plane(parent,w,d,material,x,y,z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w,d),material);
  mesh.rotation.x = -Math.PI/2;
  mesh.position.set(x,y,z);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(parent,r1,r2,h,material,x,y,z,segments=12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);
  mesh.position.set(x,y,z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function createLabelTexture(title,subtitle='',background='#17252b',accent='#d9bd7d') {
  const canvas=document.createElement('canvas');
  canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=background;ctx.fillRect(0,0,1024,256);
  ctx.fillStyle=accent;ctx.fillRect(0,0,9,256);ctx.fillRect(1015,0,9,256);
  ctx.fillStyle='#f4f1e8';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font='700 100px Arial, sans-serif';ctx.fillText(title,512,subtitle?104:128,970);
  if(subtitle){ctx.fillStyle=accent;ctx.font='500 29px Arial,sans-serif';ctx.fillText(subtitle.toUpperCase(),512,198,960);}
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}
function sign(parent,title,subtitle,x,y,z,w=7,h=1.4,rotationY=0,background='#17252b') {
  const texture=createLabelTexture(title,subtitle,background);
  const mat=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0x26201a,emissiveIntensity:0.28,roughness:0.5});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
  mesh.position.set(x,y,z);mesh.rotation.y=rotationY;parent.add(mesh);
  return mesh;
}
function addShop(parent,config) {
  const {x,z,width=8.5,floor=0,name='RETAIL',subtitle='FASHION · LIFESTYLE',color='#17252b',side=1}=config;
  const y=floor*FLOOR_HEIGHT;
  const storefrontZ=z;
  // Store bays are set back from the public promenade and framed with metal reveals.
  box(parent,width-0.18,3.35,0.22,MAT.wallWarm,x,y+2.0,storefrontZ+side*0.18);
  box(parent,width-0.55,2.75,0.13,MAT.glass,x,y+2.05,storefrontZ);
  box(parent,0.15,3.55,0.36,MAT.darkMetal,x-width/2+0.08,y+1.95,storefrontZ);
  box(parent,0.15,3.55,0.36,MAT.darkMetal,x+width/2-0.08,y+1.95,storefrontZ);
  box(parent,width-0.12,0.14,0.34,MAT.gold,x,y+3.77,storefrontZ+side*0.08);
  sign(parent,name,subtitle,x,y+4.18,storefrontZ+side*0.01,width-0.28,0.82,side===1?0:Math.PI,color);
  // Store interior is dressed enough to read through the glazed shopfront.
  const backZ=storefrontZ-side*4.0;
  box(parent,width-0.55,0.12,0.3,MAT.wood,x,y+0.85,backZ);
  for(let shelf=0;shelf<3;shelf++){
    box(parent,width-1.1,0.12,0.72,MAT.woodLight,x,y+1.2+shelf*0.76,backZ+side*0.95);
    for(let item=0;item<Math.max(2,Math.floor(width/1.5));item++){
      const ix=x-width/2+0.85+item*1.35;
      const product=box(parent,0.42,0.48,0.3,shelf%2?MAT.gold:MAT.darkMetal,ix,y+1.5+shelf*0.76,backZ+side*0.72);
      product.castShadow=true;
    }
  }
  box(parent,width-0.5,0.12,0.25,MAT.wood,x,y+0.22,backZ);
}
function addPlanter(parent,x,y,z,w=2.4,d=2.4) {
  box(parent,w,0.72,d,MAT.woodLight,x,y+0.36,z);
  box(parent,w-0.22,0.12,d-0.22,MAT.soil,x,y+0.76,z);
  for(let i=0;i<5;i++){
    const leaf=new THREE.Mesh(new THREE.SphereGeometry(0.52,8,6),i%2?MAT.plant:MAT.plantLight);
    leaf.position.set(x+(Math.random()-0.5)*w*0.52,y+1.2+Math.random()*0.35,z+(Math.random()-0.5)*d*0.52);
    leaf.scale.set(1,1.15,0.9);leaf.castShadow=true;parent.add(leaf);
  }
}
function addBench(parent,x,y,z,rotation=0) {
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;parent.add(g);
  box(g,2.6,0.18,0.72,MAT.woodLight,0,0.62,0);
  box(g,2.6,0.78,0.16,MAT.wood,0,1.02,0.27);
  for(const side of [-1,1])box(g,0.14,0.62,0.68,MAT.darkMetal,side*1.05,0.31,0);
}
function addEscalator(parent,x,y,z,angle=0.42,direction=1) {
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.x=direction*angle;parent.add(g);
  box(g,2.15,0.28,10.8,MAT.darkMetal,0,0,0,'escalator-step-bed');
  box(g,0.2,0.78,10.8,MAT.steel,-1.12,0.28,0);
  box(g,0.2,0.78,10.8,MAT.steel,1.12,0.28,0);
  box(g,0.12,0.14,10.6,MAT.black,-1.16,0.72,0);
  box(g,0.12,0.14,10.6,MAT.black,1.16,0.72,0);
  for(let i=0;i<22;i++){
    const step=box(g,1.78,0.08,0.32,MAT.steel,0,0.22,-5.0+i*0.46);
    step.castShadow=true;
  }
  return g;
}
function addRail(parent,x,y,z,length,axis='x') {
  const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);
  if(axis==='x'){
    box(g,length,0.12,0.16,MAT.steel,0,1.05,0);
    box(g,length,0.08,0.12,MAT.glass,0,0.58,0);
    const count=Math.ceil(length/1.8);
    for(let i=0;i<=count;i++)box(g,0.07,1.05,0.12,MAT.steel,-length/2+i*length/count,0.53,0);
  }else{
    box(g,0.16,0.12,length,MAT.steel,0,1.05,0);
    box(g,0.12,0.08,length,MAT.glass,0,0.58,0);
    const count=Math.ceil(length/1.8);
    for(let i=0;i<=count;i++)box(g,0.12,1.05,0.07,MAT.steel,0,0.53,-length/2+i*length/count);
  }
}
function addStoreRow(parent,floor,z,side,names) {
  const start=-55,spacing=10.0;
  names.forEach((item,index)=>{
    const x=start+index*spacing+5;
    addShop(parent,{x,z,width:9.5,floor,name:item[0],subtitle:item[1],side});
  });
}
function addFoodStall(parent,x,z,name,accent,levelY=0) {
  const baseY=levelY+1.85;
  box(parent,7,3.7,3.3,MAT.wallWarm,x,baseY,z);
  box(parent,6.55,1.7,0.12,MAT.dark,x,baseY+0.5,z+1.68);
  box(parent,6.7,0.24,0.28,MAT.gold,x,baseY+1.55,z+1.65);
  sign(parent,name,'FOOD COURT',x,baseY+2.1,z+1.78,6.3,0.92,0,accent);
  for(let i=0;i<3;i++){
    box(parent,0.32,0.52,0.14,MAT.darkMetal,x-2.2+i*2.2,baseY+0.7,z+1.55);
  }
}
function addCinema(parent,x,z,index,levelY=0) {
  const g=new THREE.Group();g.position.set(x,levelY,z);parent.add(g);
  box(g,8.6,3.7,16,MAT.black,0,2.0,0);
  box(g,7.5,2.2,0.16,MAT.screen,0,2.65,-7.85);
  for(let row=0;row<6;row++){
    for(let col=0;col<6;col++){
      const seat=new THREE.Group();seat.position.set(-3.0+col*1.2,0,2.2+row*1.3);g.add(seat);
      box(seat,0.86,0.44,0.78,MAT.seat,0,0.65,0);
      box(seat,0.86,0.9,0.18,MAT.seatDark,0,1.1,0.33);
      box(seat,0.1,0.58,0.9,MAT.darkMetal,-0.48,0.76,0.02);
      box(seat,0.1,0.58,0.9,MAT.darkMetal,0.48,0.76,0.02);
    }
  }
  sign(g,`AUDI ${String(index).padStart(2,'0')}`,'PVR CINEMAS',0,4.5,7.95,6.0,0.9,Math.PI,'#17181d');
}
function addLiftBank(parent,x,z) {
  for(let floor=0;floor<FLOOR_COUNT;floor++){
    const y=floor*FLOOR_HEIGHT;
    box(parent,5.6,3.7,0.34,MAT.wallWarm,x,y+2.0,z);
    for(let lift=0;lift<2;lift++){
      const lx=x-1.4+lift*2.8;
      box(parent,2.25,3.1,0.13,MAT.metal,lx,y+1.85,z+0.2);
      box(parent,1.8,2.7,0.08,MAT.darkGlass,lx,y+1.85,z+0.11);
      box(parent,0.12,2.95,0.13,MAT.gold,lx-1.08,y+1.85,z+0.15);
      box(parent,0.12,2.95,0.13,MAT.gold,lx+1.08,y+1.85,z+0.15);
    }
    sign(parent,'LIFTS',`LEVEL ${floor===0?'G':floor}`,x,y+4.0,z+0.28,5.1,0.62,0,'#252c31');
  }
}

export function createCP67Interior(scene) {
  const root=new THREE.Group();
  root.name='CP67-Mall-Walkable-Interior';
  root.visible=false;
  scene.add(root);

  // Public first-floor plan shows a long retail passage, shop bays, an atrium/void,
  // Lifestyle & Home Centre, Croma, M&S Fountain, escalator provision and lift lobbies.
  // The walkable level arrangement uses the documented two retail + two leisure/FEC
  // layers; unsourced shop boundaries are a playable architectural reconstruction.
  const floorMaterials=[MAT.marble,MAT.marble,MAT.marbleDark,MAT.marbleDark];
  for(let floor=0;floor<FLOOR_COUNT;floor++){
    const y=floor*FLOOR_HEIGHT;
    if(floor===0){
      box(root,124,0.35,66,floorMaterials[floor],0,y-0.18,-22,'CP67-ground-floor-marble');
    }else{
      // Keep the central atrium open to view from the ground-floor gallery.
      box(root,124,0.34,17,MAT.marble,-0.0,y-0.18,-47);
      box(root,124,0.34,14,MAT.marble,0,y-0.18,5);
      box(root,48,0.34,31,MAT.marble,-38,y-0.18,-22);
      box(root,48,0.34,31,MAT.marble,38,y-0.18,-22);
      addRail(root,-14,y,-20,31,'z');
      addRail(root,14,y,-20,31,'z');
      addRail(root,0,y,-4,27,'x');
      addRail(root,0,y,-36,27,'x');
    }

    // Main circulation gallery. Polished floor inserts and dark stone bands.
    box(root,120,0.05,9,MAT.marbleDark,0,y+0.015,-19);
    for(let i=-5;i<=5;i++){
      box(root,0.045,0.025,8,MAT.gold,i*10,y+0.055,-19);
    }
    if(floor<2){
      const northNames=floor===0
        ? [['LIFESTYLE','FASHION & HOME'],['HOME CENTRE','HOME FURNISHING'],['CROMA','ELECTRONICS'],['MARKS & SPENCER','FASHION'],['MAX','FASHION'],['TRENDS','FASHION'],['WESTSIDE','FASHION'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP']]
        : [['LIFESTYLE','FASHION'],['HOME CENTRE','HOME'],['CROMA','ELECTRONICS'],['M&S','FASHION'],['FASHION','RETAIL'],['FASHION','RETAIL'],['FOOD & BEVERAGE','DINING'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP']];
      const southNames=floor===0
        ? [['PVR ACCESS','CINEMA LOBBY'],['FASHION','RETAIL'],['OPTICALS','EYEWEAR'],['CAFÉ','COFFEE'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP']]
        : [['FASHION','RETAIL'],['FOOTWEAR','RETAIL'],['BEAUTY','RETAIL'],['CAFÉ','COFFEE'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP'],['RETAIL','SHOP']];
      addStoreRow(root,floor,-30,1,northNames);
      addStoreRow(root,floor,-7,-1,southNames);
    }else if(floor===2){
      sign(root,'CP67 FOOD HALL','RESTAURANTS · CAFÉS · FEC',0,y+5.4,-51,27,1.5,0,'#243239');
      const names=['FOOD COURT','PIZZA','BURGER','INDIAN','CAFÉ','DESSERT','ASIAN'];
      names.forEach((name,i)=>addFoodStall(root,-48+i*16,-47,name,i%2?'#7b2f2a':'#214c40',y));
      for(let row=0;row<3;row++){
        for(let col=0;col<5;col++){
          const x=-34+col*17,z=-12+row*10;
          cylinder(root,0.14,0.2,0.78,MAT.darkMetal,x,y+0.43,z,12);
          cylinder(root,0.62,0.62,0.12,MAT.darkMetal,x,y+0.82,z,16);
          cylinder(root,0.52,0.52,0.16,MAT.woodLight,x,y+0.94,z,16);
          for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
            const sx=x+Math.cos(a)*1.65,sz=z+Math.sin(a)*1.65;
            cylinder(root,0.24,0.24,0.72,MAT.darkMetal,sx,y+0.42,sz,10);
            box(root,0.8,0.18,0.78,MAT.seat,sx,y+0.85,sz);
          }
        }
      }
      for(let i=0;i<5;i++)addPlanter(root,-42+i*21,y,-1,2.3,2.0);
    }else{
      sign(root,'PVR CINEMAS','7 SCREEN MULTIPLEX',0,y+5.0,-51,29,1.5,0,'#17181d');
      for(let i=0;i<7;i++)addCinema(root,-51+i*17,-27,i+1,y);
      box(root,43,1.1,2.2,MAT.wood,-7,y+0.85,-4);
      sign(root,'TICKETS & CONCESSIONS','PVR CINEMAS',-7,y+2.3,-2.8,27,1.1,0,'#8b3827');
      for(let i=0;i<3;i++)box(root,0.8,1.1,0.5,MAT.gold,-21+i*14,y+0.62,-1.2);
    }

    // Floor-directory boards at the entrance and atrium edge.
    sign(root, floor===0?'GROUND FLOOR':floor===1?'FIRST FLOOR':floor===2?'FOOD COURT & FEC':'PVR CINEMAS',
      floor===0?'RETAIL · ENTRANCE':floor===1?'RETAIL · LIFESTYLE · HOME':'CP67 MOHALI',
      0,y+4.15,9,15,1.1,Math.PI,'#1a2a30');
  }

  // Grand entrance lobby, glazed vestibule and CP67 identity wall.
  box(root,28,4.0,0.5,MAT.glass,0,2.1,10.5);
  for(const x of [-13,-8,-3,3,8,13])box(root,0.12,4.0,0.18,MAT.steel,x,2.1,10.18);
  box(root,23,0.25,0.4,MAT.gold,0,4.15,10.2);
  sign(root,'CP67','MOHALI · SHOPPING · DINING · ENTERTAINMENT',0,5.0,9.85,22,1.25,Math.PI,'#1a2a30');
  addPlanter(root,-13,0,5,2.5,2.5);
  addPlanter(root,13,0,5,2.5,2.5);
  addBench(root,-8,0,4,0);
  addBench(root,8,0,4,0);

  // Two-level central atrium with glass balustrades, pendant lights and hanging banners.
  const atriumCentreZ=-20;
  for(const x of [-11.5,11.5]){
    for(const z of [-34,-25,-16,-7]){
      box(root,0.3,8.8,0.3,MAT.wallWarm,x,4.4,z);
    }
  }
  addEscalator(root,-5.4,0.12,-21,-0.42,1);
  addEscalator(root,5.4,0.12,-21,-0.42,-1);
  addEscalator(root,-5.4,FLOOR_HEIGHT+0.12,-21,-0.42,1);
  addEscalator(root,5.4,FLOOR_HEIGHT+0.12,-21,-0.42,-1);
  for(let i=0;i<8;i++){
    const x=-9+i*2.6;
    const lamp=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,3.6,10),MAT.gold);
    lamp.position.set(x,13.2,atriumCentreZ);root.add(lamp);
    const shade=new THREE.Mesh(new THREE.ConeGeometry(0.85,0.65,10),MAT.ceiling);
    shade.position.set(x,11.25,atriumCentreZ);root.add(shade);
    const light=new THREE.PointLight(0xffe0b2,16,13);
    light.position.set(x,10.9,atriumCentreZ);root.add(light);
  }
  addPlanter(root,-9,0,-20,2.1,2.1);addPlanter(root,9,0,-20,2.1,2.1);
  addBench(root,-8,0,-11,0);addBench(root,8,0,-11,0);

  // Lift cores and stair/elevator wayfinding. E near a lift changes accessible level.
  addLiftBank(root,55,-18);
  for(let floor=0;floor<FLOOR_COUNT;floor++){
    const y=floor*FLOOR_HEIGHT;
    const stairX=-56;
    for(let run=0;run<14;run++){
      box(root,3.8,0.18,0.34,MAT.marble,stairX,y+0.22+run*0.25,-15+run*0.22);
    }
    for(const side of [-1,1])box(root,0.14,1.0,5.0,MAT.steel,stairX+side*2.0,y+0.8,-13.5);
    sign(root,'STAIRS','FIRE EXIT',stairX,y+2.1,-10.3,4.8,0.65,0,'#7b3029');
  }

  // PVR level gets seven auditorium entries and a warm illuminated lobby.
  sign(root,'PVR CINEMAS','AUDITORIUMS 01–07',23,1.0,-3,3.9+3*FLOOR_HEIGHT,-35,0,'#17181d');

  // Interactive area is deliberately bounded to the documented retail podium.
  const collision = {
    minX:-60.5,maxX:60.5,minZ:-53.5,maxZ:9.2,
    atrium:{minX:-13.5,maxX:13.5,minZ:-35.5,maxZ:-4.5},
    elevator:{x:55,z:-18,radius:7.0},
    exit:{minX:-9,maxX:9,z:9.2},
    entrance:{minX:-11,maxX:11,z:11.0}
  };
  return {
    group:root,
    floorCount:FLOOR_COUNT,
    floorHeight:FLOOR_HEIGHT,
    collision,
    spawn:{x:0,y:0.9,z:7.4},
    isInside(x,z){return x>collision.minX&&x<collision.maxX&&z>collision.minZ&&z<collision.exit.z;},
    isWalkable(x,z,floor){
      if(x<collision.minX||x>collision.maxX||z<collision.minZ||z>collision.maxZ)return false;
      if(floor>0&&x>collision.atrium.minX&&x<collision.atrium.maxX&&z>collision.atrium.minZ&&z<collision.atrium.maxZ)return false;
      return true;
    },
    nearElevator(x,z){return Math.hypot(x-collision.elevator.x,z-collision.elevator.z)<collision.elevator.radius;},
    nearestFloor(x,z){return 0;},
    setFloor(floor){
      const target=THREE.MathUtils.clamp(floor,0,FLOOR_COUNT-1);
      return target;
    },
    dispose(){
      root.traverse(object=>{
        if(object.geometry)object.geometry.dispose();
        if(object.material){
          const materials=Array.isArray(object.material)?object.material:[object.material];
          materials.forEach(material=>{if(material.map)material.map.dispose();material.dispose();});
        }
      });
      scene.remove(root);
    }
  };
}
