onmessage = function(message) {
    
    console.time("parsing feature");

    var features = message.data.features;
    var featureZero = features[0].attributes;
    var baseObject = createBaseObject(featureZero);
    var count = features.length;

    for(var a = 0; a < features.length; a++){
        parseFeature(features[a].attributes);
    }

    console.timeEnd("parsing feature");

    postMessage(parseBaseObject(baseObject));

    function parseFeature(attributes){
        for (var key in attributes) {
            if (attributes.hasOwnProperty(key)) {
                if(typeof attributes[key] == "number"){

                    // Add a new value to baseObject property's array
                    baseObject[key].push(attributes[key]);
                }
            }
        }
    }

    function createBaseObject(feature){
        var object = {};

        for (var key in feature) {
            if (feature.hasOwnProperty(key)) {
                // console.log(key + " -> " + JSON.stringify(feature[key]));
                if(typeof feature[key] == "number"){
                    object[key] = [];
                }
            }
        }

        return object;
    }

    function parseBaseObject(object){

        var values = {};
        values.features = {};
        values.count = count; // total number of features;

        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                values.features[key] = {
                    max: Math.max.apply(null, object[key]),
                    min: Math.min.apply(null, object[key])
                }
            }
        }

        return values;
    }
};