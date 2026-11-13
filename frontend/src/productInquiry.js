const websites = {
 'James Hardie':'https://www.jameshardie.com/', 'Allura':'https://allurausa.com/', 'GAF':'https://www.gaf.com/', 'Nichiha':'https://www.nichiha.com/', 'Fiberon':'https://www.fiberoncladding.com/', 'Moen':'https://www.moen.com/', 'Kohler':'https://www.kohler.com/', 'Niagara':'https://niagaracorp.com/', 'Rheem':'https://www.rheem.com/', 'U.S. Boiler':'https://www.usboiler.net/', 'Navien':'https://www.navieninc.com/', 'Rainwater Management Solutions':'https://rainwatermanagement.com/', 'CertainTeed':'https://www.certainteed.com/', 'RenewAire':'https://renewaire.com/', 'Rachio':'https://rachio.com/', 'ATAS':'https://www.atas.com/', 'Euroshield':'https://www.euroshieldroofing.com/'
};
export function companyWebsite(product) {
 if (websites[product.brand]) return websites[product.brand];
 try { const url = new URL(product.companyWebsite || product.sourceUrl); return url.protocol === 'https:' && !url.hostname.endsWith('.gov') ? url.origin + '/' : null; } catch { return null; }
}
export function leadForHome(lead, home) {
 return home.demoScenario ? {...lead} : {...lead, propertyAddress:home.address, zip:home.zip};
}
