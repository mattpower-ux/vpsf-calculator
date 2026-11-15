// These explanations document model intent, not a statistical calibration.
const groups = [
  {fields:['hers'], purpose:'VPSF gives the whole-home energy rating a large share of the Energy budget, with smaller additions for individual systems.', tradeoff:'A whole-home rating can already reflect equipment and solar. Review overlapping credits before changing the lookup values. The VPSF points are not the HERS index itself.'},
  {fields:['hvac','hydronicSource','heatingControls'], purpose:'VPSF differentiates heating technologies, recorded efficiency, and controls. Energy and Carbon rules can reward different aspects of the same system.', tradeoff:'The selected point differences are policy rankings, not calculated fuel savings or emissions. Climate, supply-water temperature, electricity supply, and actual equipment performance can change the outcome.'},
  {fields:['solar','solarKw','batteryKwh','evReady'], purpose:'These rules recognize recorded generation, storage, or readiness features in the relevant pillar.', tradeoff:'A presence-based rule does not model annual production, battery runtime, installed capacity, or bills. Backup and Energy credits should represent distinct benefits.'},
  {fields:['fortified'], purpose:'The certification lookup gives a documented package of resilience measures more weight than most individual features.', tradeoff:'Certification levels address different hazards and scopes. Baseline points for None or Unknown are model conventions, not evidence of protection. Audit overlap with separate roof, siding, and opening credits.'},
  {fields:['wildfire'], purpose:'The model uses a matched USFS regional exposure classification to adjust Resilience: Low +10, Medium 0, High −10, Very High −20.', tradeoff:'This is a location adjustment, separate from measures on the property. The point steps are VPSF policy; the regional percentile is not the probability that this particular home will burn.'},
  {fields:['wildfireMitigation'], purpose:'The lookup credits recorded defensible space, ember-resistant vents, or the combination. It represents protection of ignition pathways beyond siding.', tradeoff:'A combined option should not accidentally receive each component credit again. These points do not quantify lives or structures saved, and the present model does not simulate ember exposure.'},
  {fields:['roof','roofAge','flood','moisture','backup','temperatureProtection','windProtection'], purpose:'The rule assigns relative credit to a recorded property protection or durability characteristic within the Resilience budget.', tradeoff:'The number is not a measured reduction in damage probability. Review the exact match condition, hazard relevance, installation details, and overlap with certification or other features before increasing it.'},
  {fields:['waterStandard','toilet','toilets','faucet','faucets','showerhead','showerheads','dishwasher','irrigation','landscape','reuse','leak'], purpose:'VPSF uses these inputs to prioritize water conservation, water reuse, and prevention of leak damage. The active rule and pillar determine which benefit is credited.', tradeoff:'Whole-home certification and individual fixture credits can overlap. A fixed bonus or penalty is not a measured number of gallons saved. Check whether the rule is per category or per fixture; do not imply per-fixture multiplication unless the rule actually does it.'},
  {fields:['healthCert','ventilation','materials','iaq','daylighting'], purpose:'VPSF assigns relative priority to recorded indoor-environment features or certification evidence.', tradeoff:'The weight is not a medical outcome estimate. A monitor records conditions; it does not itself correct them. Check overlap between a certification package and separately credited features.'},
  {fields:['carbonStrategy','carbonConcrete','structure'], purpose:'VPSF distinguishes the level of carbon documentation and selected material strategies.', tradeoff:'Documentation and estimated reductions are different signals. These points are not kilograms of CO₂ avoided; a project-specific life-cycle assessment would be needed for that claim.'},
  {fields:['pietim','insurance','warranty','maintenance'], purpose:'These rules represent ownership-cost exposure, documented coverage, warranties, and planning within Financial Risk.', tradeoff:'They are not a lending decision, appraisal, insurance quote, or predicted loss. Ratio thresholds and point steps are model policy and should be tested across representative households.'},
  {fields:['epaWalkability','walkscore','transit','greenspace','amenities','bike'], purpose:'VPSF assigns a small, distinct budget to access and neighborhood context. EPA index rules and legacy WalkScore rules are separate inputs.', tradeoff:'The EPA index is an area-level measure, not an address-level walking audit. Avoid adding both legacy and EPA credits for the same underlying signal without explicitly budgeting for it.'}
];

export function rationaleFor(factor) {
  if (factor.field === 'siding') return {
    purpose:'Noncombustible exterior cladding removes a potential source of fuel at the wall. The VPSF rule applies to the listed material choices, regardless of manufacturer or sponsorship.',
    tradeoff:'The original +30 allocation is an editorial model choice requested for VPSF, not a research-derived estimate of homes saved. Treat it as provisional pending calibration against other resilience measures. Wall assemblies, joints, vents, windows, nearby fuels, and neighboring structures still matter.',
    siding:true
  };
  return groups.find(group=>group.fields.includes(factor.field)) || {
    purpose:'This factor assigns relative importance to the selected condition in its pillar. Read the condition and the point schedule below before interpreting the allocation.',
    tradeoff:'No factor-specific research rationale has been documented here yet. Treat this as an admin-defined policy weight. Record supporting evidence and compare with other measures before presenting it as empirically calibrated.'
  };
}

export function factorWeightSummary(factor) {
  if (!factor) return 'Not in this model';
  if (!factor.active) return 'Retired — no points applied';
  if (factor.mode === 'wildfire') return '−20 to +10 points, according to matched regional risk';
  if (factor.mode === 'lookup') return Object.entries(factor.options || {}).map(([choice,points])=>`${choice}: ${points > 0 ? '+' : ''}${points}`).join(' · ') + ` · Fallback: ${factor.default ?? 0}`;
  return `${factor.points > 0 ? '+' : ''}${factor.points} points when the condition matches`;
}

export function allocationShare(factor,cap) {
  if (!factor || !cap || !factor.active || factor.mode === 'lookup' || factor.mode === 'wildfire') return null;
  return Math.round(Math.abs(factor.points) / cap * 1000) / 10;
}
