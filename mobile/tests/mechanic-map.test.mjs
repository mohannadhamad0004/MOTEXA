import test from 'node:test';
import assert from 'node:assert/strict';
import {servicePosition, serviceRouteIdentity} from '../src/features/shared/serviceDestination.ts';
import {shouldRefreshLocationRoute} from '../src/core/constants/geo.ts';
const city = {lat:32.22,lng:35.25}, workshop={lat:32.223,lng:35.254};
test('approximate mechanic pin displays without a destination',()=>{
 const p=servicePosition(undefined,city);
 assert.deepEqual(p.displayPosition,city); assert.equal(p.routeDestination,null); assert.equal(p.approx,true);
});
test('public workshop supplies the destination and display position',()=>{
 const p=servicePosition(workshop,city);
 assert.deepEqual(p.routeDestination,workshop); assert.deepEqual(p.displayPosition,workshop); assert.equal(p.approx,false);
});
test('missing and invalid public coordinates never promote a fallback',()=>{
 for(const value of [null,{}, {lat:NaN,lng:35}, {lat:32,lng:null}, {lat:91,lng:35}]){
 assert.equal(servicePosition(value,city).routeDestination,null);
 }
});
test('nearby mechanic replacement refreshes by identity, GPS jitter does not',()=>{
 const a=serviceRouteIdentity({kind:'mech',id:'a'}), b=serviceRouteIdentity({kind:'mech',id:'b'});
 const anchor={requestId:a,from:city,to:workshop};
 const nearby={lat:workshop.lat+0.00001,lng:workshop.lng};
 assert.equal(shouldRefreshLocationRoute(anchor,a,city,nearby,50),false);
 assert.equal(shouldRefreshLocationRoute(anchor,b,city,nearby,50),true);
});
test('tow and parts public bases remain usable and identities distinguish services',()=>{
 for(const kind of ['tow','shop']){
 assert.deepEqual(servicePosition(workshop,null).routeDestination,workshop);
 assert.notEqual(serviceRouteIdentity({kind,id:'a'}),serviceRouteIdentity({kind:'mech',id:'a'}));
 }
});
