import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ROAD_ASSET_URL = new URL('../other/american_road.glb', import.meta.url).href;
const NON_DRIVABLE = new Set(['footway','path','pedestrian','cycleway','steps','track','bridleway']);

function distance2D(a,b){return Math.hypot(b.x-a.x,b.z-a.z);}

export class RoadAssetRenderer {
  constructor(onStatus=()=>{}){
    this.onStatus=onStatus;
    this.loader=new GLTFLoader();
    this.template=null;
    this.loading=null;
    this.failed=null;
    this.tiles=new Map();
    this.dummy=new THREE.Object3D();
  }

  addRoads(roads,tileKey){
    let record=this.tiles.get(tileKey);
    if(record)return record.group;
    const group=new THREE.Group();
    group.name=`american-road-assets-${tileKey}`;
    const drivable=(roads||[]).filter(road=>
      !NON_DRIVABLE.has(road.type)&&Array.isArray(road.points)&&road.points.length>1
    );
    record={group,roads:drivable,meshes:[]};
    this.tiles.set(tileKey,record);
    if(this.template)this.populateTile(record);
    else if(!this.loading&&!this.failed)this.loadAsset();
    return group;
  }

  async loadAsset(){
    if(this.loading||this.template||this.failed)return this.loading;
    this.loading=(async()=>{
      try{
        this.onStatus('LOADING REAL ROAD SURFACE · AMERICAN ROAD');
        const gltf=await this.loader.loadAsync(ROAD_ASSET_URL);
        this.template=this.prepareTemplate(gltf.scene);
        for(const record of this.tiles.values())this.populateTile(record);
        this.onStatus('REAL ROAD SURFACE READY');
        console.info('[GTA-TriCity] American road asset ready',this.template.size);
      }catch(error){
        this.failed=error;
        this.onStatus('ROAD MODEL FAILED · KEEPING OSM ROAD SURFACES');
        console.warn('[GTA-TriCity] American road GLB could not be loaded; OSM roads remain active.',error);
      }finally{
        this.loading=null;
      }
    })();
    return this.loading;
  }

  prepareTemplate(source){
    source.updateMatrixWorld(true);
    const sourceBounds=new THREE.Box3().setFromObject(source);
    if(sourceBounds.isEmpty())throw new Error('American road GLB contains no visible mesh geometry');
    const sourceSize=sourceBounds.getSize(new THREE.Vector3());
    if(sourceSize.x<0.5||sourceSize.z<0.5)throw new Error('American road asset is not a horizontal road segment');

    // Align whichever horizontal axis is longest to local +Z. OSM road segments
    // are then oriented by yaw while sharing a single normalized road mesh.
    const axisRotation=sourceSize.x>sourceSize.z?-Math.PI/2:0;
    const alignMatrix=new THREE.Matrix4().makeRotationY(axisRotation);
    const entries=[];
    const combinedBounds=new THREE.Box3();
    source.traverse(object=>{
      if(!object.isMesh||!object.geometry||!object.material)return;
      const geometry=object.geometry.clone();
      geometry.applyMatrix4(object.matrixWorld);
      geometry.applyMatrix4(alignMatrix);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      combinedBounds.union(geometry.boundingBox);
      entries.push({geometry,material:object.material});
    });
    if(!entries.length)throw new Error('American road GLB has no mesh parts');

    const size=combinedBounds.getSize(new THREE.Vector3());
    if(size.x<0.5||size.z<1.0)throw new Error(`Unexpected road segment dimensions X=${size.x.toFixed(2)} Y=${size.y.toFixed(2)} Z=${size.z.toFixed(2)}`);
    const center=combinedBounds.getCenter(new THREE.Vector3());
    const normalizeMatrix=new THREE.Matrix4().makeTranslation(-center.x,-combinedBounds.min.y,-center.z);
    for(const entry of entries){
      entry.geometry.applyMatrix4(normalizeMatrix);
      entry.geometry.computeBoundingSphere();
    }

    // Merge only geometries with the same material set; fall back safely for
    // source meshes with incompatible vertex attributes or material groups.
    const buckets=new Map();
    const fallback=[];
    for(const entry of entries){
      const materials=Array.isArray(entry.material)?entry.material:[entry.material];
      const key=materials.map(m=>m.uuid).join('|');
      if(!buckets.has(key))buckets.set(key,{material:entry.material,geometries:[]});
      buckets.get(key).geometries.push(entry.geometry);
    }
    const parts=[];
    for(const bucket of buckets.values()){
      if(bucket.geometries.length>1){
        try{
          const merged=mergeGeometries(bucket.geometries,false);
          if(merged){
            parts.push({geometry:merged,material:bucket.material});
            bucket.geometries.forEach(g=>g.dispose());
            continue;
          }
        }catch(error){
          console.warn('[GTA-TriCity] Road geometry merge fallback',error);
        }
      }
      for(const geometry of bucket.geometries)parts.push({geometry,material:bucket.material});
    }
    if(!parts.length)throw new Error('Unable to prepare American road geometry');
    return {parts,width:size.x,length:size.z,size:{x:size.x,y:size.y,z:size.z}};
  }

  buildInstances(roads,template){
    const records=[];
    // Keep surface texture scale sensible by splitting long OSM ways into repeatable
    // sections rather than stretching one road texture over an entire kilometre.
    const sectionLength=THREE.MathUtils.clamp(template.length,10,28);
    for(const road of roads){
      const width=THREE.MathUtils.clamp(Number(road.width)||5.5,2.4,24);
      for(let i=1;i<road.points.length;i++){
        const a=road.points[i-1],b=road.points[i];
        const dx=b.x-a.x,dz=b.z-a.z,total=Math.hypot(dx,dz);
        if(total<1.0)continue;
        const count=Math.max(1,Math.ceil(total/sectionLength));
        const yaw=Math.atan2(dx,dz);
        for(let part=0;part<count;part++){
          const t0=part/count,t1=(part+1)/count;
          const x0=THREE.MathUtils.lerp(a.x,b.x,t0),z0=THREE.MathUtils.lerp(a.z,b.z,t0);
          const x1=THREE.MathUtils.lerp(a.x,b.x,t1),z1=THREE.MathUtils.lerp(a.z,b.z,t1);
          const length=Math.hypot(x1-x0,z1-z0);
          if(length<0.7)continue;
          records.push({
            x:(x0+x1)*0.5,
            z:(z0+z1)*0.5,
            yaw,
            width,
            length:length*1.012
          });
        }
      }
    }
    return records;
  }

  populateTile(record){
    if(!this.template||record.meshes.length||!record.roads.length)return;
    const instances=this.buildInstances(record.roads,this.template);
    if(!instances.length)return;
    for(const part of this.template.parts){
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,instances.length);
      mesh.name='american-road-instanced-surface';
      mesh.frustumCulled=true;
      mesh.castShadow=false;
      mesh.receiveShadow=false;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      for(let i=0;i<instances.length;i++){
        const item=instances[i];
        this.dummy.position.set(item.x,0.085,item.z);
        this.dummy.rotation.set(0,item.yaw,0);
        this.dummy.scale.set(
          item.width/this.template.width,
          1,
          item.length/this.template.length
        );
        this.dummy.updateMatrix();
        mesh.setMatrixAt(i,this.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();
      record.group.add(mesh);
      record.meshes.push(mesh);
    }
  }

  getStatus(){
    return {
      loaded:Boolean(this.template),
      loading:Boolean(this.loading),
      failed:Boolean(this.failed),
      tiles:this.tiles.size,
      dimensions:this.template?.size||null
    };
  }

  dispose(){
    for(const record of this.tiles.values())record.group.clear();
    this.tiles.clear();
    if(this.template){
      for(const part of this.template.parts)part.geometry.dispose();
      this.template=null;
    }
  }
}
