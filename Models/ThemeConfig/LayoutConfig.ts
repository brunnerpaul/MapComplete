import {Translation} from "../../UI/i18n/Translation";
import {LayoutConfigJson} from "./Json/LayoutConfigJson";
import AllKnownLayers from "../../Customizations/AllKnownLayers";
import {Utils} from "../../Utils";
import LayerConfig from "./LayerConfig";
import {LayerConfigJson} from "./Json/LayerConfigJson";
import Constants from "../Constants";
import TilesourceConfig from "./TilesourceConfig";
import DependencyCalculator from "./DependencyCalculator";

export default class LayoutConfig {
    public readonly id: string;
    public readonly maintainer: string;
    public readonly credits?: string;
    public readonly version: string;
    public readonly language: string[];
    public readonly title: Translation;
    public readonly shortDescription?: Translation;
    public readonly description: Translation;
    public readonly descriptionTail?: Translation;
    public readonly icon: string;
    public readonly socialImage?: string;
    public readonly startZoom: number;
    public readonly startLat: number;
    public readonly startLon: number;
    public readonly widenFactor: number;
    public readonly defaultBackgroundId?: string;
    public layers: LayerConfig[];
    public tileLayerSources: TilesourceConfig[]
    public readonly clustering?: {
        maxZoom: number,
        minNeededElements: number,
    };
    public readonly hideFromOverview: boolean;
    public lockLocation: boolean | [[number, number], [number, number]];
    public readonly enableUserBadge: boolean;
    public readonly enableShareScreen: boolean;
    public readonly enableMoreQuests: boolean;
    public readonly enableAddNewPoints: boolean;
    public readonly enableLayers: boolean;
    public readonly enableSearch: boolean;
    public readonly enableGeolocation: boolean;
    public readonly enableBackgroundLayerSelection: boolean;
    public readonly enableShowAllQuestions: boolean;
    public readonly enableExportButton: boolean;
    public readonly enablePdfDownload: boolean;
    public readonly enableIframePopout: boolean;

    public readonly customCss?: string;

    public readonly overpassUrl: string[];
    public readonly overpassTimeout: number;
    public readonly overpassMaxZoom: number
    public readonly osmApiTileSize: number
    public readonly official: boolean;
    public readonly trackAllNodes: boolean;

    constructor(json: LayoutConfigJson, official = true, context?: string) {
        this.official = official;
        this.id = json.id;
        if(json.id.toLowerCase() !== json.id){
            throw "The id of a theme should be lowercase: "+json.id
        }
        if(json.id.match(/[a-z0-9-_]/) == null){
            throw "The id of a theme should match [a-z0-9-_]*: "+json.id
        }
        context = (context ?? "") + "." + this.id;
        this.maintainer = json.maintainer;
        this.credits = json.credits;
        this.version = json.version;
        this.language = [];

        if (typeof json.language === "string") {
            this.language = [json.language];
        } else {
            this.language = json.language;
        }
        if (this.language.length == 0) {
            throw `No languages defined. Define at least one language. (${context}.languages)`
        }
        if (json.title === undefined) {
            throw "Title not defined in " + this.id;
        }
        if (json.description === undefined) {
            throw "Description not defined in " + this.id;
        }
        this.title = new Translation(json.title, context + ".title");
        this.description = new Translation(json.description, context + ".description");
        this.shortDescription = json.shortDescription === undefined ? this.description.FirstSentence() : new Translation(json.shortDescription, context + ".shortdescription");
        this.descriptionTail = json.descriptionTail === undefined ? undefined : new Translation(json.descriptionTail, context + ".descriptionTail");
        this.icon = json.icon;
        this.socialImage = json.socialImage;
        this.startZoom = json.startZoom;
        this.startLat = json.startLat;
        this.startLon = json.startLon;
        if (json.widenFactor <= 0) {
            throw "Widenfactor too small, shoud be > 0"
        }
        if (json.widenFactor > 20) {
            throw "Widenfactor is very big, use a value between 1 and 5 (current value is " + json.widenFactor + ") at " + context
        }

        this.widenFactor = json.widenFactor ?? 1.5;

        this.defaultBackgroundId = json.defaultBackgroundId;
        this.tileLayerSources = (json.tileLayerSources ?? []).map((config, i) => new TilesourceConfig(config, `${this.id}.tileLayerSources[${i}]`))
        const layerInfo = LayoutConfig.ExtractLayers(json, official, context);
        this.layers = layerInfo.layers


        this.clustering = {
            maxZoom: 16,
            minNeededElements: 25,
        };
        if (json.clustering === false) {
            this.clustering = {
                maxZoom: 0,
                minNeededElements: 100000,
            };
        } else if (json.clustering) {
            this.clustering = {
                maxZoom: json.clustering.maxZoom ?? 18,
                minNeededElements: json.clustering.minNeededElements ?? 25,
            }
        }

        this.hideFromOverview = json.hideFromOverview ?? false;
        // @ts-ignore
        if (json.hideInOverview) {
            throw "The json for " + this.id + " contains a 'hideInOverview'. Did you mean hideFromOverview instead?"
        }
        this.lockLocation = <[[number, number], [number, number]]>json.lockLocation ?? undefined;
        this.enableUserBadge = json.enableUserBadge ?? true;
        this.enableShareScreen = json.enableShareScreen ?? true;
        this.enableMoreQuests = json.enableMoreQuests ?? true;
        this.enableLayers = json.enableLayers ?? true;
        this.enableSearch = json.enableSearch ?? true;
        this.enableGeolocation = json.enableGeolocation ?? true;
        this.enableAddNewPoints = json.enableAddNewPoints ?? true;
        this.enableBackgroundLayerSelection = json.enableBackgroundLayerSelection ?? true;
        this.enableShowAllQuestions = json.enableShowAllQuestions ?? false;
        this.enableExportButton = json.enableDownload ?? false;
        this.enablePdfDownload = json.enablePdfDownload ?? false;
        this.enableIframePopout = json.enableIframePopout ?? true
        this.customCss = json.customCss;
        this.overpassUrl = Constants.defaultOverpassUrls
        if (json.overpassUrl !== undefined) {
            if (typeof json.overpassUrl === "string") {
                this.overpassUrl = [json.overpassUrl]
            } else {
                this.overpassUrl = json.overpassUrl
            }
        }
        this.overpassTimeout = json.overpassTimeout ?? 30
        this.overpassMaxZoom = json.overpassMaxZoom ?? 17
        this.osmApiTileSize = json.osmApiTileSize ?? this.overpassMaxZoom + 1

    }

    private static ExtractLayers(json: LayoutConfigJson, official: boolean, context: string): { layers: LayerConfig[], extractAllNodes: boolean } {
        const result: LayerConfig[] = []
        let exportAllNodes = false
        if(json.layers === undefined){
            throw "Got undefined layers for "+json.id+" at "+context
        }
        json.layers.forEach((layer, i) => {

            if (typeof layer === "string") {
                if (AllKnownLayers.sharedLayersJson.get(layer) !== undefined) {
                    if (json.overrideAll !== undefined) {
                        let lyr = JSON.parse(JSON.stringify(AllKnownLayers.sharedLayersJson.get(layer)));
                        const newLayer = new LayerConfig(Utils.Merge(json.overrideAll, lyr), `${json.id}+overrideAll.layers[${i}]`, official)
                        result.push(newLayer)
                        return
                    } else {
                        const shared = AllKnownLayers.sharedLayers.get(layer)
                        if (shared === undefined) {
                            throw `Shared layer ${layer} not found (at ${context}.layers[${i}])`
                        }
                        result.push(shared)
                        return
                    }
                } else {
                    console.log("Layer ", layer, " not kown, try one of", Array.from(AllKnownLayers.sharedLayers.keys()).join(", "))
                    throw `Unknown builtin layer ${layer} at ${context}.layers[${i}]`;
                }
            }

            if (layer["builtin"] === undefined) {
                if (json.overrideAll !== undefined) {
                    layer = Utils.Merge(json.overrideAll, layer);
                }
                // @ts-ignore
                result.push(new LayerConfig(layer, `${json.id}.layers[${i}]`, official))
                return
            }

            // @ts-ignore
            let names = layer.builtin;
            if (typeof names === "string") {
                names = [names]
            }
            
            // This is a very special layer which triggers special behaviour
            exportAllNodes = names.some(name => name === "type_node");
            
            names.forEach(name => {
                const shared = AllKnownLayers.sharedLayersJson.get(name);
                if (shared === undefined) {
                    throw `Unknown shared/builtin layer ${name} at ${context}.layers[${i}]. Available layers are ${Array.from(AllKnownLayers.sharedLayersJson.keys()).join(", ")}`;
                }
                let newLayer: LayerConfigJson = Utils.Merge(layer["override"], JSON.parse(JSON.stringify(shared))); // We make a deep copy of the shared layer, in order to protect it from changes
                if (json.overrideAll !== undefined) {
                    newLayer = Utils.Merge(json.overrideAll, newLayer);
                }
                result.push(new LayerConfig(newLayer, `${json.id}.layers[${i}]`, official))
                return
            })

        });

        // Some special layers which are always included by default
        for (const defaultLayer of AllKnownLayers.added_by_default) {
            if (result.some(l => l?.id === defaultLayer)) {
                continue; // Already added
            }
            const sharedLayer = AllKnownLayers.sharedLayers.get(defaultLayer)
            if (sharedLayer !== undefined) {
                result.push(sharedLayer)
            }else if(!AllKnownLayers.runningGenerateScript){
                throw "SharedLayer "+defaultLayer+" not found"
            }
        }

        if(AllKnownLayers.runningGenerateScript){
            return {layers: result, extractAllNodes: exportAllNodes}
        }
        // Verify cross-dependencies
        let unmetDependencies: { neededLayer: string, neededBy: string, reason: string, context?: string }[] = []
        do {
            const dependencies: { neededLayer: string, reason: string, context?: string, neededBy: string }[] = []

            for (const layerConfig of result) {
                const layerDeps = DependencyCalculator.getLayerDependencies(layerConfig)
                dependencies.push(...layerDeps)
            }

            const loadedLayers = new Set(result.map(r => r.id))
            // During the generate script, builtin layers are verified but not loaded - so we have to add them manually here
            // Their existance is checked elsewhere, so this is fine
            unmetDependencies = dependencies.filter(dep => !loadedLayers.has(dep.neededLayer))
            for (const unmetDependency of unmetDependencies) {
                const dep = AllKnownLayers.sharedLayers.get(unmetDependency.neededLayer)
                if (dep === undefined) {
                  
                    const message = 
                        ["Loading a dependency failed: layer "+unmetDependency.neededLayer+" is not found, neither as layer of "+json.id+" nor as builtin layer.",
                            "This layer is needed by "+unmetDependency.neededBy,
                            unmetDependency.reason+" (at "+unmetDependency.context+")",
                            "Loaded layers are: "+result.map(l => l.id).join(",")
                        
                    ]
                    throw message.join("\n\t");
                }
                result.unshift(dep)
                unmetDependencies = unmetDependencies.filter(d => d.neededLayer  !== unmetDependency.neededLayer)
            }

        } while (unmetDependencies.length > 0)
        
        return {layers: result, extractAllNodes: exportAllNodes}
    }

    public CustomCodeSnippets(): string[] {
        if (this.official) {
            return [];
        }
        const msg = "<br/><b>This layout uses <span class='alert'>custom javascript</span>, loaded for the wide internet. The code is printed below, please report suspicious code on the issue tracker of MapComplete:</b><br/>"
        const custom = [];
        for (const layer of this.layers) {
            custom.push(...layer.CustomCodeSnippets().map(code => code + "<br />"))
        }
        if (custom.length === 0) {
            return custom;
        }
        custom.splice(0, 0, msg);
        return custom;
    }

    public ExtractImages(): Set<string> {
        const icons = new Set<string>()
        for (const layer of this.layers) {
            layer.ExtractImages().forEach(icons.add, icons)
        }
        icons.add(this.icon)
        icons.add(this.socialImage)
        return icons
    }

    /**
     * Replaces all the relative image-urls with a fixed image url
     * This is to fix loading from external sources
     *
     * It should be passed the location where the original theme file is hosted.
     *
     * If no images are rewritten, the same object is returned, otherwise a new copy is returned
     */
    public patchImages(originalURL: string, originalJson: string): LayoutConfig {
        const allImages = Array.from(this.ExtractImages())
        const rewriting = new Map<string, string>()

        // Needed for absolute urls: note that it doesn't contain a trailing slash
        const origin = new URL(originalURL).origin
        let path = new URL(originalURL).href
        path = path.substring(0, path.lastIndexOf("/"))
        for (const image of allImages) {
            if (image == "" || image == undefined) {
                continue
            }
            if (image.startsWith("http://") || image.startsWith("https://")) {
                continue
            }
            if (image.startsWith("/")) {
                // This is an absolute path
                rewriting.set(image, origin + image)
            } else if (image.startsWith("./assets/themes")) {
                // Legacy workaround
                rewriting.set(image, path + image.substring(image.lastIndexOf("/")))
            } else if (image.startsWith("./")) {
                // This is a relative url
                rewriting.set(image, path + image.substring(1))
            } else {
                // This is a relative URL with only the path
                rewriting.set(image, path + image)
            }
        }
        if (rewriting.size == 0) {
            return this;
        }
        rewriting.forEach((value, key) => {
            console.log("Rewriting", key, "==>", value)
            originalJson = originalJson.replace(new RegExp(key, "g"), value)
        })
        return new LayoutConfig(JSON.parse(originalJson), false, "Layout rewriting")
    }

    public isLeftRightSensitive() {
        return this.layers.some(l => l.isLeftRightSensitive())
    }

    public getMatchingLayer(tags: any): LayerConfig | undefined {
        if (tags === undefined) {
            return undefined
        }
        for (const layer of this.layers) {
            if (layer.source.osmTags.matchesProperties(tags)) {
                return layer
            }
        }
        return undefined
    }

}