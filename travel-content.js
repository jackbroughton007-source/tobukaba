(function (root) {
    "use strict";

    // Add future companions here. Each companion needs a stable id, a pond
    // image, and the fixed-route milestone that discovers them.
    const CONTENT = {
        version: 3,
        labels: { systemName: "TobuKaba’s Journey", homeName: "Home Pond", journeyName: "Journey Progress" },
        progression: {
            requiredUnits: 30,
            lessonUnits: 1,
            firstSuccessfulReviewUnits: 1,
            intervalMilestones: [
                { id: "interval-7", days: 7, units: 1 },
                { id: "interval-30", days: 30, units: 1 }
            ]
        },
        companions: [{
            id: "map-tanuki",
            name: "Kotaro",
            species: "Island cat",
            description: "A calm, independent island cat who likes a sunny spot beside the pond.",
            image: "assets/companions/kotaro/kotaro-home-pond.png",
            portraitAsset: "assets/companions/kotaro/kotaro-portrait.png",
            milestoneUnits: 8,
            pondPosition: { left: 76.5, top: 35.5, width: 13 }
        }],
        homePond: {
            canvas: { width: 1672, height: 941 },
            layers: [
                { id: "sky", asset: "assets/home-pond/spring/sky-v1.png", depth: 1 },
                { id: "distant-island", asset: "assets/home-pond/spring/distant-island-v1.png", depth: 2 },
                { id: "far-bank", asset: "assets/home-pond/spring/far-bank-v1.png", depth: 3 },
                { id: "pond-water", asset: "assets/home-pond/spring/pond-water-v1.png", depth: 4 },
                { id: "main-bank", asset: "assets/home-pond/spring/main-bank-v1.png", depth: 5 },
                { id: "tree-and-dock", asset: "assets/home-pond/spring/tree-and-dock-v1.png", depth: 6 },
                { id: "habitat-details", asset: "assets/home-pond/spring/habitat-details-v1.png", depth: 7 },
                { id: "foreground-plants", asset: "assets/home-pond/spring/foreground-plants-v1.png", depth: 12 }
            ],
            capeAsset: "assets/home-pond/spring/cape-draped-v3.png",
            anchors: {
                tobuKaba: { left: 35, top: 62, width: 18 },
                pondInteraction: { left: 50, top: 63, width: 70, height: 48 }
            },
            motion: {
                enabled: true,
                seed: "spring-home-pond-v3",
                clouds: { asset: "assets/home-pond/spring/clouds-motion-v1.png", depth: 1, duration: 72, delay: -19, opacity: 0.72, travelPercent: 8.05 },
                water: { asset: "assets/home-pond/spring/water-reflections-motion-v2.png", depth: 8, duration: 11.8, delay: -4.5, opacity: 0.24, amplitude: 2.3, secondaryDuration: 8.6, secondaryDelay: -2.8, secondaryOpacity: 0.1, horizontalScale: 0.0069, waterlineDuration: 7.8, waterlineDelay: -2.25 },
                lilyPad: { asset: "assets/home-pond/spring/lily-pad-motion-v2.png", depth: 4, duration: 28, delay: -11, opacity: 0.96, scale: 0.72, startXPercent: -7, endXPercent: 5, verticalPercent: -11, bobPixels: 1, rotationDegrees: 0.4, clip: "polygon(44% 61%,66% 61%,66% 70%,44% 70%)" },
                artworkAccents: [
                    { id: "tree-tip", kind: "leaves", asset: "assets/home-pond/spring/foliage-motion-v1.png", depth: 8, clip: "polygon(24% 3%,42% 3%,42% 25%,24% 25%)", origin: "29% 18%", duration: 10.2, delay: -6.7, amplitude: 1.6 },
                    { id: "left-reeds", kind: "reeds", asset: "assets/home-pond/spring/foliage-motion-v1.png", depth: 8, clip: "inset(41% 90% 34% 0)", origin: "4% 60%", duration: 8.2, delay: -2.7, amplitude: 1.5 },
                    { id: "right-reeds", kind: "reeds", asset: "assets/home-pond/spring/foliage-motion-v1.png", depth: 8, clip: "inset(35% 0 34% 81%)", origin: "91% 60%", duration: 9.3, delay: -5.4, amplitude: 1.4 },
                    { id: "near-left-grass", kind: "grass", asset: "assets/home-pond/spring/foliage-motion-v1.png", depth: 13, clip: "inset(76% 76% 0 1%)", origin: "12% 96%", duration: 7.2, delay: -3.1, amplitude: 2 },
                    { id: "near-right-grass", kind: "grass", asset: "assets/home-pond/spring/foliage-motion-v1.png", depth: 13, clip: "inset(76% 18% 0 62%)", origin: "73% 96%", duration: 8.1, delay: -6.2, amplitude: 1.9 }
                ],
                rareEvent: { id: "spring-butterfly", enabled: true, asset: "assets/home-pond/spring/butterfly-event-v1.png", depth: 8, intervalSeconds: 24, delay: -8, scale: 0.45, availableTimes: ["dawn", "morning", "day", "golden", "sunset"] },
                characters: { tobuKaba: { floatSeconds: 8, floatPixels: 1, blinkSeconds: 11 }, kotaro: { breatheSeconds: 7.5, earTwitchSeconds: 23, tailTwitchSeconds: 37 } }
            }
        }
    };

    root.TOBUKABA_TRAVEL_CONTENT = CONTENT;
    if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
})(typeof globalThis !== "undefined" ? globalThis : this);
