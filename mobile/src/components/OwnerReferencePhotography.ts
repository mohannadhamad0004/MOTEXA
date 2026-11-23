import type {OwnerVehicle} from './OwnerTypes';
/** Catalog photographs are not individual customer uploads or a trim/specification guarantee. */
export function ownerReferencePhotography(v:OwnerVehicle){
 const make=v.make.trim().toLowerCase(),model=v.model.trim().toLowerCase();
 if(make==='audi'&&/^rs7( sportback)?$/.test(model))return {source:require('../../assets/images/owner-audi-photo-cutout-v11.png'),credit:'Tyler Clemmensen · Unsplash',sourceUrl:'https://unsplash.com/photos/4gSavS9pe1s',photographic:true};
 if(/^(range rover|land rover)$/.test(make)&&/^(sport|range rover sport)$/.test(model)&&v.year===2023)return {source:require('../../assets/images/owner-range-photo-cutout-v11.png'),credit:'Calreyn88 · CC BY-SA 4.0',sourceUrl:'https://commons.wikimedia.org/wiki/File:2023_Range_Rover_Sport_1.jpg',photographic:true};
 if(/^(toyota|تويوتا)$/.test(make)&&/^(corolla|كورولا)$/.test(model)&&v.year===2018)return {source:require('../../assets/images/owner-corolla-2018.webp'),credit:'EurovisionNim · CC BY-SA 4.0',sourceUrl:'https://commons.wikimedia.org/wiki/File:2018_Toyota_Corolla_(ZRE172R)_Ascent_sedan_(2018-08-27).jpg',photographic:true};
 return null;
}
