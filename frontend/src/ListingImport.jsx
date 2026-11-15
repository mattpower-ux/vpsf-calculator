import React, { useState } from 'react';
import DocumentUpload from './DocumentUpload.jsx';
import { importListing } from './api/client.js';
import zillow from './assets/listings/zillow.svg';
import realtor from './assets/listings/realtor.png';
import redfin from './assets/listings/redfin.png';
import './listingImport.css';

export const LISTING_SOURCES = {
  mls:{name:'MLS', logo:null}, zillow:{name:'Zillow',logo:zillow},
  realtor:{name:'Realtor.com',logo:realtor}, redfin:{name:'Redfin',logo:redfin},
};
export function ListingLogo({source}) {
  const brand = LISTING_SOURCES[source];
  return brand.logo ? <img className="listingBrandLogo" src={brand.logo} alt={brand.name}/> : <span className="mlsWordmark" aria-label="MLS">MLS<small>Multiple Listing Service</small></span>;
}
const labels = {address:'Street address',city:'City',state:'State',zip:'ZIP code',squareFeet:'Square footage',yearBuilt:'Year built',bedrooms:'Bedrooms',bathrooms:'Bathrooms'};
export default function ListingImport({source='mls',onApply}) {
  const [url,setUrl]=useState(''),[listingId,setListingId]=useState(''),[market,setMarket]=useState('');
  const [address,setAddress]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[facts,setFacts]=useState(null);
  const brand=LISTING_SOURCES[source];
  async function readListing(event) {
    event.preventDefault(); setBusy(true); setError(''); setFacts(null);
    try {
      const result=await importListing({source,url:url.trim(),listingId:listingId.trim(),market:market.trim()});
      const found=Object.fromEntries(Object.entries(result.facts || {}).filter(([key,value])=>labels[key] && value !== null && String(value).trim()).map(([key,value])=>[key,String(value)]));
      if (!Object.keys(found).length) throw new Error('No home details were available. Enter the address below or upload a listing sheet.');
      setFacts(found);
    } catch(err) {setError(err.message || 'The listing could not be imported.');}
    finally {setBusy(false);}
  }
  return <div className="screen formScreen withNav listingEntry">
    <h2>Import {brand.name} Listing</h2><div className="listingEntryLogo"><ListingLogo source={source}/></div>
    <p className="subhead">Enter the listing you want to evaluate.</p>
    <form className="formSection" onSubmit={readListing}>
      <label className="field fieldWide"><span>{brand.name} listing URL</span><input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder={source==='mls'?'https://your-mls.com/listing/...':`https://www.${source==='realtor'?'realtor.com':source+'.com'}/...`} disabled={busy}/></label>
      <label className="field fieldWide"><span>Listing number or ID</span><input value={listingId} onChange={e=>setListingId(e.target.value)} placeholder="Optional when using a URL" disabled={busy}/></label>
      {source==='mls' && <label className="field fieldWide"><span>MLS or market name</span><input value={market} onChange={e=>setMarket(e.target.value)} placeholder="For example, California Regional MLS" disabled={busy}/></label>}
      <p className="fieldWide">A public listing URL works best. Number-only searches require access to the listing service.</p>
      <button className="primaryButton fieldWide" disabled={busy || (!url.trim()&&!listingId.trim())}>{busy?'Reading listing…':'Import listing details'}</button>
      {error && <p role="alert" className="fieldWide">{error}</p>}
    </form>
    {facts && <section className="formSection"><h3>Review listing details</h3><p className="fieldWide">Check these details before applying them to your evaluation.</p>{Object.entries(facts).map(([key,value])=><label className="field" key={key}><span>{labels[key]}</span><input value={value} onChange={e=>setFacts({...facts,[key]:e.target.value})}/></label>)}<button className="primaryButton fieldWide" onClick={()=>onApply(facts)}>Apply reviewed details</button></section>}
    <section className="formSection"><h3>Use the property address</h3><label className="field fieldWide"><span>Full property address</span><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street, city, state, ZIP"/></label><button className="secondaryButton fieldWide" disabled={!address.trim()} onClick={()=>onApply({address:address.trim()})}>Continue with this address</button></section>
    <section className="formSection"><h3>Or upload a listing sheet</h3><DocumentUpload onApply={onApply}/></section>
  </div>;
}
