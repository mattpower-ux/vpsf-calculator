export const totalBudget = (model) => Object.values(model.pillars).reduce((sum, points) => sum + Number(points || 0), 0);

export function addFactor(model, factor) {
  if (model.factors.some((item) => item.id === factor.id)) throw new Error("Factor ID already exists");
  return { ...model, factors: [...model.factors, factor] };
}

export function retireFactor(model, id) {
  return { ...model, factors: model.factors.map((factor) => factor.id === id ? { ...factor, active: false } : factor) };
}

export function splitFactor(model, id) {
  const parent = model.factors.find((factor) => factor.id === id);
  if (!parent || !parent.active || parent.mode === "wildfire") throw new Error("This factor cannot be split");
  const leftId = `${id}_a`;
  const rightId = `${id}_b`;
  if (model.factors.some((factor) => [leftId, rightId].includes(factor.id))) throw new Error("Factor has already been split");
  const splitOptions = (rounder) => Object.fromEntries(Object.entries(parent.options || {}).map(([key, value]) => [key, rounder(value / 2)]));
  const children = [
    { ...parent, id: leftId, label: `${parent.label} A`, parentId: id, points: Math.floor(parent.points / 2), options: splitOptions(Math.floor) },
    { ...parent, id: rightId, label: `${parent.label} B`, parentId: id, points: Math.ceil(parent.points / 2), options: splitOptions(Math.ceil) }
  ];
  return { ...model, factors: [...model.factors.map((factor) => factor.id === id ? { ...factor, active: false } : factor), ...children] };
}
