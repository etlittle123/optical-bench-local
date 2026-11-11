/*
 * 器件插件注册表：复制一个条目即可添加新器件。
 * transform(beam, params) 接收上一段光束状态，并返回下一段状态。
 */
window.OPTICAL_COMPONENTS = {
  laser: {name:'激光器', icon:'◉', category:'source', rayBehavior:'source', defaults:{wavelength:800,power:100,repetitionRate:1,polarization:0,waistRadius:1,m2:1,pulseWidth:50,gdd:0}, transform:b=>b},
  mirror: {name:'反射镜', icon:'╱', category:'passive', rayBehavior:'reflect', defaults:{aperture:25.4,reflectivity:99}, transform:(b,p)=>({...b,power:b.power*(p.reflectivity??99)/100})},
  beamsplitter: {name:'分束镜', icon:'◇', category:'passive', rayBehavior:'split', defaults:{aperture:25.4,thickness:5,refractiveIndex:1.5,materialGdd:0,reflectivity:50,transmission:50}, transform:b=>b},
  dichroic: {name:'二向色镜', icon:'◩', category:'passive', rayBehavior:'dichroic', defaults:{aperture:25.4,cutoffWavelength:650,reflectBand:'short',reflection:98,transmission:95,thickness:2,refractiveIndex:1.5,materialGdd:0}, transform:b=>b},
  hwp: {name:'半波片', icon:'λ/2', category:'polarization', defaults:{aperture:25.4,thickness:1,refractiveIndex:1.55,materialGdd:0,axisAngle:0,transmission:98}, transform:(b,p)=>({...b,power:b.power*(p.transmission??98)/100,polarization:(2*(p.axisAngle??0)-b.polarization+360)%180})},
  qwp: {name:'四分之一波片', icon:'λ/4', category:'polarization', defaults:{aperture:25.4,thickness:1,refractiveIndex:1.55,materialGdd:0,axisAngle:45,transmission:98}, transform:(b,p)=>({...b,power:b.power*(p.transmission??98)/100,ellipticity:45})},
  polarizer: {name:'偏振片', icon:'↕', category:'polarization', defaults:{aperture:25.4,thickness:1,refractiveIndex:1.5,materialGdd:0,axisAngle:0,transmission:90}, transform:(b,p)=>{const d=((b.polarization-(p.axisAngle??0))*Math.PI/180);return {...b,power:b.power*Math.cos(d)**2*(p.transmission??90)/100,polarization:p.axisAngle??0}}},
  lens: {name:'透镜', icon:'()', category:'passive', defaults:{aperture:25.4,thickness:4,refractiveIndex:1.5,materialGdd:0,focalLength:100,transmission:99}, transform:(b,p)=>({...b,power:b.power*(p.transmission??99)/100})},
  delay: {name:'折返延时台', icon:'↪', category:'path', rayBehavior:'retroreflect', defaults:{travel:0,targetDelay:0,returnOffset:20,reflectivity:98,scanStart:-1,scanEnd:1,scanStep:0.1}, transform:(b,p)=>({...b,power:b.power*((p.reflectivity??98)/100)**2})},
  iris: {name:'光阑', icon:'◎', category:'aperture', defaults:{aperture:5}, transform:b=>b},
  nd: {name:'ND 滤光片', icon:'▨', category:'filter', defaults:{aperture:25.4,opticalDensity:1,thickness:1,refractiveIndex:1.5,materialGdd:0}, transform:(b,p)=>({...b,power:b.power*10**(-Math.max(0,p.opticalDensity??1))})},
  spectralFilter: {name:'波长滤光片', icon:'▤', category:'filter', defaults:{aperture:25.4,filterType:'shortpass',cutoffWavelength:650,passTransmission:90,blockTransmission:0.1,thickness:2,refractiveIndex:1.5,materialGdd:0}, transform:(b,p)=>{const pass=p.filterType==='longpass'?b.wavelength>=p.cutoffWavelength:b.wavelength<=p.cutoffWavelength;return{...b,power:b.power*(pass?p.passTransmission:p.blockTransmission)/100}}},
  bbo: {name:'BBO 倍频/混频晶体', icon:'2ω', category:'nonlinear', rayBehavior:'shg', defaults:{aperture:10,thickness:0.5,refractiveIndex:1.66,materialGdd:0,conversionEfficiency:5,mixingEfficiency:2,transmission:95,phaseMatchAngle:29.2,targetCrossingAngle:0,angleTolerance:5,polarizationMode:'any',polarizationTolerance:10}, transform:b=>b},
  sample: {name:'样品', icon:'▣', category:'target', rayBehavior:'stop', defaults:{aperture:20,thickness:0.5,refractiveIndex:1.6,transmission:100}, transform:(b,p)=>({...b,power:b.power*(p.transmission??100)/100})},
  detector: {name:'探测器', icon:'◒', category:'target', rayBehavior:'stop', defaults:{aperture:9.8,responsivity:0.5,transimpedanceGain:1000,saturationPower:10,minWavelength:200,maxWavelength:1100}, transform:b=>b}
};
