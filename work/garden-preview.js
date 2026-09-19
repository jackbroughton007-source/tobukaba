const scene = document.getElementById("learningGardenScene");
const parameters = new URLSearchParams(location.search);
const season = parameters.get("season");
const time = parameters.get("time");
if (["spring","summer","autumn","winter"].includes(season)) scene.dataset.season = season;
if (["dawn","morning","day","golden","sunset","evening","night"].includes(time)) scene.dataset.time = time;
const sleepingMascot = document.querySelector(".garden-tobukaba-sleeping");
if (scene.dataset.time === "night" && sleepingMascot) {
  const showSleepingPose = () => scene.classList.add("sleeping-mascot-ready");
  if (sleepingMascot.complete && sleepingMascot.naturalWidth > 0) showSleepingPose();
  else sleepingMascot.addEventListener("load", showSleepingPose, { once:true });
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const hippo = document.getElementById("gardenTobuKabaButton");
hippo.addEventListener("click", () => {
  if (reducedMotion()) return;
  hippo.classList.remove("is-blinking");
  void hippo.offsetWidth;
  hippo.classList.add("is-blinking");
  setTimeout(() => hippo.classList.remove("is-blinking"), 560);
});

document.querySelectorAll(".garden-plot-visual").forEach(plot => plot.addEventListener("click", () => {
  if (reducedMotion()) return;
  plot.classList.remove("is-swaying");
  void plot.offsetWidth;
  plot.classList.add("is-swaying");
  setTimeout(() => plot.classList.remove("is-swaying"), 720);
}));

const pond = document.getElementById("gardenPond");
pond.addEventListener("click", event => {
  if (reducedMotion()) return;
  pond.querySelectorAll(".garden-reaction").forEach(node => node.remove());
  const bounds = pond.getBoundingClientRect();
  const x = event.detail ? event.clientX - bounds.left : bounds.width * .52;
  const y = event.detail ? event.clientY - bounds.top : bounds.height * .52;
  for (let index = 0; index < 5; index++) {
    const node = document.createElement("span");
    node.className = `garden-reaction ${index < 2 ? "garden-reaction-ripple" : "garden-reaction-bubble"}`;
    node.style.setProperty("--reaction-x", `${x + (index - 2) * 6}px`);
    node.style.setProperty("--reaction-y", `${y + index * 2}px`);
    node.style.setProperty("--bubble-delay", `${index * 60}ms`);
    pond.appendChild(node);
  }
  setTimeout(() => pond.querySelectorAll(".garden-reaction").forEach(node => node.remove()), 900);
});
