/* Focused Cubism Core renderer: original meshes, native masks and parameters.
 * No remote resources and no fallback static portrait in the character canvas.
 */
import {prepareExpressionGeometry} from './expression-geometry.js';
export class Character {
  constructor(canvas) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl2',{alpha:true,antialias:true,stencil:true,preserveDrawingBuffer:true});
    if(!this.gl) throw new Error('显卡没有提供 WebGL2，请检查显卡驱动。');
    this.frames=0; this.mode='room'; this.zoom=1;this.anchorX=.69;
  }
  async load(base) {
    this.base=base;
    this.setting=await fetch(base+'AliceKuonjiWinter.model3.json').then(r=>{if(!r.ok)throw Error('模型入口文件缺失');return r.json();});
    const bytes=await fetch(base+this.setting.FileReferences.Moc).then(r=>r.arrayBuffer());
    this.moc=Live2DCubismCore.Moc.fromArrayBuffer(bytes);
    if(!this.moc || this.moc.hasMocConsistency(bytes)!==1) throw Error('模型完整性检查未通过。');
    this.model=Live2DCubismCore.Model.fromMoc(this.moc);
    if(!this.model) throw Error('模型无法由 Cubism Core 创建。');
    this.model.update();
    const flat=this.model.drawables.vertexPositions;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const vertices of flat) for(let i=0;i<vertices.length;i+=2){minX=Math.min(minX,vertices[i]);maxX=Math.max(maxX,vertices[i]);minY=Math.min(minY,vertices[i+1]);maxY=Math.max(maxY,vertices[i+1]);}
    this.bounds={minX,maxX,minY,maxY};
    this.parameterIndex=Object.fromEntries(this.model.parameters.ids.map((id,i)=>[id,i]));
    const faceIndex=this.model.drawables.ids.indexOf('ArtMeshFace');
    const faceVertices=faceIndex>=0?this.model.drawables.vertexPositions[faceIndex]:[];
    const faceYs=Array.from(faceVertices).filter((_,i)=>i%2===1);
    const faceLow=faceYs.length?Math.min(...faceYs):minY,faceHigh=faceYs.length?Math.max(...faceYs):maxY;
    this.shadeY=[faceLow+(faceHigh-faceLow)*.26,faceLow+(faceHigh-faceLow)*.88];
    this.shadedDrawables=new Set(this.model.drawables.ids.map((id,i)=>/^(ArtMeshFace(?:Detail)?$|ArtMeshEyewhite|ArtMeshIrides|ArtMeshEyebrow|ArtMeshNose)/.test(id)?i:-1));
    const gl=this.gl;
    this.irisBounds=new Map();for(const [i,id] of this.model.drawables.ids.entries())if(/^ArtMeshIrides/.test(id)){const u=this.model.drawables.vertexUvs[i],xs=[],ys=[];for(let j=0;j<u.length;j+=2){xs.push(u[j]);ys.push(1-u[j+1]);}const left=Math.min(...xs),top=Math.min(...ys);this.irisBounds.set(i,[left,top,Math.max(.0001,Math.max(...xs)-left),Math.max(.0001,Math.max(...ys)-top)]);}
    const compile=(type,code)=>{const shader=gl.createShader(type);gl.shaderSource(shader,code);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
    const vertex=`#version 300 es\n in vec2 position;in vec2 uv;uniform vec2 scale;uniform vec2 center;out vec2 tc;out float modelY;void main(){gl_Position=vec4((position-center)*scale,0.,1.);tc=vec2(uv.x,1.-uv.y);modelY=position.y;}`;
    const fragment=`#version 300 es\n precision highp float;in vec2 tc;in float modelY;uniform sampler2D image;uniform sampler2D clipMask;uniform sampler2D restingHands;uniform sampler2D layerCutout;uniform bool cutLayer;uniform float eraseHands;uniform bool cutGarment;uniform vec4 garmentOpenings[2];uniform vec3 garmentAxes[2];uniform bool useMask;uniform bool invertMask;uniform vec2 viewport;uniform float opacity;uniform float faceShade;uniform float spiralEyes;uniform vec4 irisBounds;uniform vec2 shadeY;out vec4 color;void main(){vec4 pixel=texture(image,tc);if(spiralEyes>.001){vec2 q=(tc-irisBounds.xy)/irisBounds.zw*2.-1.;float r=length(q),coil=abs(sin(19.*r-atan(q.y,q.x)));float line=max(1.-smoothstep(.11,.32,coil),1.-smoothstep(.04,.12,r));vec3 ink=mix(vec3(.79,.70,.65),vec3(.13,.09,.16),line);pixel.rgb=mix(pixel.rgb,ink,spiralEyes);}float alpha=pixel.a*opacity;if(cutLayer){
      vec2 stepUV=2.5/vec2(textureSize(layerCutout,0));float removed=0.;
      for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)removed=max(removed,texture(layerCutout,tc+vec2(x,y)*stepUV).a);
      alpha*=1.-smoothstep(.001,.15,removed);
    }if(useMask){float mask=texture(clipMask,gl_FragCoord.xy/viewport).a;alpha*=invertMask?1.-mask:mask;}if(eraseHands>0.){vec2 q=gl_FragCoord.xy/viewport,px=vec2(3.5)/viewport;float h=texture(restingHands,q).a;h=max(h,texture(restingHands,q+vec2(px.x,0.)).a);h=max(h,texture(restingHands,q-vec2(px.x,0.)).a);h=max(h,texture(restingHands,q+vec2(0.,px.y)).a);h=max(h,texture(restingHands,q-vec2(0.,px.y)).a);h=max(h,texture(restingHands,q+px).a);h=max(h,texture(restingHands,q-px).a);h=max(h,texture(restingHands,q+vec2(px.x,-px.y)).a);h=max(h,texture(restingHands,q+vec2(-px.x,px.y)).a);alpha*=1.-eraseHands*smoothstep(.001,.045,h);}if(cutGarment){vec2 q=vec2(gl_FragCoord.x,viewport.y-gl_FragCoord.y);for(int k=0;k<2;k++){vec4 o=garmentOpenings[k];vec3 a=garmentAxes[k];vec2 delta=q-o.xy;float across=dot(delta,vec2(-a.y,a.x))/o.z,along=dot(delta,a.xy)/o.w;float edge=smoothstep(.88,1.04,length(vec2(across,along)));alpha*=mix(1.,edge,a.z);}}if(alpha<0.001)discard;float shade=faceShade*smoothstep(shadeY.x,shadeY.y,modelY);color=vec4(mix(pixel.rgb,vec3(.16,.12,.20),shade),alpha);}`;
    this.program=gl.createProgram();gl.attachShader(this.program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);
    if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    this.locations={position:gl.getAttribLocation(this.program,'position'),uv:gl.getAttribLocation(this.program,'uv'),scale:gl.getUniformLocation(this.program,'scale'),center:gl.getUniformLocation(this.program,'center'),opacity:gl.getUniformLocation(this.program,'opacity'),clipMask:gl.getUniformLocation(this.program,'clipMask'),useMask:gl.getUniformLocation(this.program,'useMask'),invertMask:gl.getUniformLocation(this.program,'invertMask'),viewport:gl.getUniformLocation(this.program,'viewport'),faceShade:gl.getUniformLocation(this.program,'faceShade'),shadeY:gl.getUniformLocation(this.program,'shadeY')};
    gl.uniform1i(gl.getUniformLocation(this.program,'image'),0);
    gl.uniform1i(this.locations.clipMask,1);
    this.locations.spiralEyes=gl.getUniformLocation(this.program,'spiralEyes');this.locations.irisBounds=gl.getUniformLocation(this.program,'irisBounds');
    this.locations.cutLayer=gl.getUniformLocation(this.program,'cutLayer');gl.uniform1i(gl.getUniformLocation(this.program,'layerCutout'),3);
    this.locations.cutGarment=gl.getUniformLocation(this.program,'cutGarment');this.locations.garmentOpenings=gl.getUniformLocation(this.program,'garmentOpenings[0]');this.locations.garmentAxes=gl.getUniformLocation(this.program,'garmentAxes[0]');this.locations.eraseHands=gl.getUniformLocation(this.program,'eraseHands');gl.uniform1i(gl.getUniformLocation(this.program,'restingHands'),2);
    this.maskFramebuffer=gl.createFramebuffer();this.maskTexture=gl.createTexture();
    this.handFramebuffer=gl.createFramebuffer();this.handTexture=gl.createTexture();this.handIndices=this.model.drawables.ids.flatMap((id,i)=>id.startsWith('ArtMeshHandwear')?[i]:[]);
    this.dummyMask=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.dummyMask);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    this.textures=await Promise.all(this.setting.FileReferences.Textures.map(file=>new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>{const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);resolve(texture);};image.onerror=()=>reject(Error('纹理缺失：'+file));image.src=base+file;
    })));
    this.pBuffer=gl.createBuffer();this.uBuffer=gl.createBuffer();this.iBuffer=gl.createBuffer();
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
    this.order=Array.from({length:this.model.drawables.count},(_,i)=>i);
    this.ready=true;
  }
  set(id,value){const index=this.parameterIndex[id];if(index!==undefined){const p=this.model.parameters; p.values[index]=Math.max(p.minimumValues[index],Math.min(p.maximumValues[index],value));}}
  reset(){this.model.parameters.values.set(this.model.parameters.defaultValues);}
  drawMesh(index,rawHands=false){
    const gl=this.gl,d=this.model.drawables,l=this.locations;
    gl.uniform1i(l.cutLayer,0);const iris=this.irisBounds.get(index);gl.uniform1f(l.spiralEyes,iris?this.spiralEyes||0:0);if(iris)gl.uniform4fv(l.irisBounds,iris);
    gl.uniform1f(l.faceShade,this.shadedDrawables.has(index)?this.faceShadow||0:0);gl.uniform2f(l.shadeY,...this.shadeY);
    gl.uniform1f(l.eraseHands,!rawHands&&d.ids[index]==='ArtMeshBottomwear'?1-(this.handsOpacity??1):0);
    const cut=!rawHands&&d.ids[index]==='ArtMeshTopwear'&&this.garmentOpenings;gl.uniform1i(l.cutGarment,cut?1:0);if(cut){gl.uniform4fv(l.garmentOpenings,this.garmentOpenings);gl.uniform3fv(l.garmentAxes,this.garmentAxes);}
    gl.bindTexture(gl.TEXTURE_2D,this.textures[d.textureIndices[index]]);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.pBuffer);gl.bufferData(gl.ARRAY_BUFFER,this.drawOverrides?.get(index)||this.expressionGeometry?.get(index)||d.vertexPositions[index],gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(l.position);gl.vertexAttribPointer(l.position,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.uBuffer);gl.bufferData(gl.ARRAY_BUFFER,d.vertexUvs[index],gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(l.uv);gl.vertexAttribPointer(l.uv,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.iBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,d.indices[index],gl.DYNAMIC_DRAW);gl.uniform1f(l.opacity,d.opacities[index]*(!rawHands&&d.ids[index].startsWith('ArtMeshHandwear')?(this.handsOpacity??1):1));gl.drawElements(gl.TRIANGLES,d.indices[index].length,gl.UNSIGNED_SHORT,0);
  }
  textureFromImage(image){const g=this.gl,t=g.createTexture();g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);return t;}
  drawTextureMesh(texture,mesh,{eraseTexture=null}={}){const g=this.gl,l=this.locations;g.uniform1f(l.spiralEyes,0);g.uniform1i(l.cutLayer,eraseTexture?1:0);if(eraseTexture){g.activeTexture(g.TEXTURE3);g.bindTexture(g.TEXTURE_2D,eraseTexture);}g.uniform1i(l.useMask,0);g.uniform1f(l.faceShade,0);g.uniform1f(l.eraseHands,0);g.uniform1i(l.cutGarment,0);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,texture);for(const [buffer,data,attribute]of [[this.pBuffer,mesh.positions,l.position],[this.uBuffer,mesh.uvs,l.uv]]){g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,data,g.DYNAMIC_DRAW);g.enableVertexAttribArray(attribute);g.vertexAttribPointer(attribute,2,g.FLOAT,false,0,0);}g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,this.iBuffer);g.bufferData(g.ELEMENT_ARRAY_BUFFER,mesh.indices,g.STATIC_DRAW);g.uniform1f(l.opacity,1);g.drawElements(g.TRIANGLES,mesh.indices.length,g.UNSIGNED_SHORT,0);g.uniform1i(l.cutLayer,0);}
  render(){
    this.model.update();
    prepareExpressionGeometry(this);
    const gl=this.gl,c=this.canvas,l=this.locations,b=this.bounds;
    const dpr=Math.min(window.devicePixelRatio,2),width=Math.round(c.clientWidth*dpr),height=Math.round(c.clientHeight*dpr);
    if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
    if(this.maskWidth!==width||this.maskHeight!==height){
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.maskFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.maskTexture,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('眼部透明度遮罩无法创建。');
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.maskWidth=width;this.maskHeight=height;
      gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.handTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.bindFramebuffer(gl.FRAMEBUFFER,this.handFramebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.handTexture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('手臂遮罩无法创建。');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    gl.viewport(0,0,c.width,c.height);gl.useProgram(this.program);gl.disable(gl.STENCIL_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(l.viewport,c.width,c.height);gl.uniform1i(l.useMask,0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.dummyMask);gl.activeTexture(gl.TEXTURE0);
    const modelHeight=b.maxY-b.minY;
    const multiplier=({pet:this.petHeight??.84,room:.82,full:.88,portrait:1.85,face:3.4}[this.mode]||1.85)*this.zoom;
    const sx=2*multiplier/modelHeight*c.height/c.width,sy=2*multiplier/modelHeight;
    const centerY=this.mode==='pet'?b.minY+(2*(this.petGround??.945)-1)/sy:this.mode==='room'?b.minY+.78/sy:this.mode==='full'?(b.maxY+b.minY)/2:this.mode==='face'?b.maxY-modelHeight*.127:b.maxY-modelHeight*.237;
    const centerX=(b.minX+b.maxX)/2-(2*(this.anchorX??.69)-1)/sx;
    gl.uniform2f(l.scale,sx,sy);gl.uniform2f(l.center,centerX,centerY);
    // Remove the small resting-glove overlap baked into the skirt layer only
    // during the new pose. The mask comes from the native hand meshes themselves.
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.dummyMask);gl.activeTexture(gl.TEXTURE0);
    if((this.handsOpacity??1)<.999){gl.bindFramebuffer(gl.FRAMEBUFFER,this.handFramebuffer);gl.clear(gl.COLOR_BUFFER_BIT);for(const index of this.handIndices)this.drawMesh(index,true);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.handTexture);gl.activeTexture(gl.TEXTURE0);}
    this.placement={anchorX:this.anchorX,scaleX:sx,scaleY:sy,centerX,centerY,top:this.mode==='room'?.89-multiplier:null,ground:this.mode==='room'?.89:null};
    this.prepareClothing?.();
    this.wardrobe?.drawBack();
    const d=this.model.drawables,orders=this.model.getRenderOrders();
    this.order.sort((a,b)=>orders[a]-orders[b]);
    let drawn=0;
    for(const index of this.order){
      if(this.wardrobe?.skip(this.model.drawables.ids[index]))continue;
      if(d.opacities[index]<=.001)continue;
      if(d.maskCounts[index]){
        // Render native clipping meshes into an RGBA target. Retaining their
        // alpha avoids the binary stencil edge on irises and thin eyelids.
        gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.dummyMask);gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(l.useMask,0);gl.bindFramebuffer(gl.FRAMEBUFFER,this.maskFramebuffer);gl.clear(gl.COLOR_BUFFER_BIT);
        for(let m=0;m<d.maskCounts[index];m++)this.drawMesh(d.masks[index][m]);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.maskTexture);gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(l.useMask,1);gl.uniform1i(l.invertMask,(d.constantFlags[index]&8)?1:0);
      }else{gl.uniform1i(l.useMask,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.dummyMask);gl.activeTexture(gl.TEXTURE0);}
      this.drawMesh(index);drawn++;
    }
    this.wardrobe?.drawFront();gl.uniform1i(l.useMask,0);this.frames++;this.drawn=drawn;
  }
  meshBounds(id){const index=this.model.drawables.ids.indexOf(id),p=this.placement;if(index<0||!p)return null;const vertices=this.model.drawables.vertexPositions[index];let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(let i=0;i<vertices.length;i+=2){const x=((vertices[i]-p.centerX)*p.scaleX+1)*this.canvas.clientWidth/2,y=(1-(vertices[i+1]-p.centerY)*p.scaleY)*this.canvas.clientHeight/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return {left,right,top,bottom,width:right-left,height:bottom-top};}
  alphaAt(x,y){const c=this.canvas;if(x<0||y<0||x>=c.clientWidth||y>=c.clientHeight)return 0;const pixel=new Uint8Array(4);this.gl.readPixels(Math.floor(x*c.width/c.clientWidth),c.height-1-Math.floor(y*c.height/c.clientHeight),1,1,this.gl.RGBA,this.gl.UNSIGNED_BYTE,pixel);return pixel[3];}
  diagnostic(){
    const gl=this.gl,p=this.model.parameters;
    const rgba=new Uint8Array(this.canvas.width*this.canvas.height*4);gl.readPixels(0,0,this.canvas.width,this.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    let visiblePixels=0,checksum=0;
    for(let i=3;i<rgba.length;i+=4){if(rgba[i]>30)visiblePixels++;checksum=(Math.imul(checksum,31)+rgba[i-3]+rgba[i-2]+rgba[i-1]+rgba[i])|0;}
    return {frames:this.frames,spiralEyes:this.spiralEyes||0,expressionMeshesFinite:!this.expressionGeometry||Array.from(this.expressionGeometry.values()).every(a=>a.every(Number.isFinite)),consistency:1,drawables:this.model.drawables.count,drawn:this.drawn,parameters:Object.fromEntries(p.ids.map((id,i)=>[id,p.values[i]])),finite:this.model.drawables.vertexPositions.every(a=>a.every(Number.isFinite)),visiblePixels,pixelChecksum:checksum,bounds:this.bounds,placement:this.placement,glError:gl.getError()};
  }
}

