let loadingFromModButton = false;

const modList = [];
const tagList = [];
let favoriteMods = new Set();

let onlyFavorites = false;

let nameFilter = "";

$(document).ready(async function() {

    favoriteMods = localStorage.getItem("favoriteMods") != null ? localStorage.getItem("favoriteMods") : new Set();

    if(typeof favoriteMods == 'string') {
        favoriteMods = new Set(favoriteMods.split(","));
    }

    var originalOptions = null;

    $('.tagCheckbox').on('change', filterEntries);

    await loadEntries();
    let mods = document.getElementById('modSelect').childNodes;

    let tagsFound = new Set();

    mods.forEach(function(mod) {
        const tags = mod.dataset.tags.split(" ");
        for(let i = 0; i < tags.length; i++) {
            if(tags[i].length == 0) {
                continue;
            }
            tagsFound.add(tags[i]);
        }
    });

    mods.forEach(async function(mod) {

        if(mod.value == "other") {
            return;
        }

        const modRes = await fetch("../static/mods/" + mod.value + "_init.html");
        const rawModText = await modRes.text();
        let codeSnippet = null;
        let temp = {}
        let start = ""
        let end = ""

        if(rawModText.includes(".election_json = JSON.parse(")) {
            start = ".election_json = JSON.parse(";
            end = ")"
        } else if(rawModText.includes(".election_json = [")) {
            start = ".election_json = [";
            end = "]"
        } else {
            console.log("Could not extract metadata for mod: " + mod.value);
        }

        let possibleEndIndices = getAllIndexes(rawModText, end);

        for(let i = 0; i < possibleEndIndices.length; i++) {
            codeSnippet = rawModText.slice(rawModText.indexOf(start), possibleEndIndices[i] + 1);
            if(codeSnippet.length <= 0) {
                continue;
            }

            try {
                eval("temp" + codeSnippet)
            } catch {
                codeSnippet = null;
            }

            if(codeSnippet != null) {
                break;
            }
        }

        if(codeSnippet == null || Object.keys(temp).length == 0) {
            console.log("Could not extract from " + mod.value)
        }

        let imageUrl = temp.election_json[0].fields.site_image ?? temp.election_json[0].fields.image_url;
        let description = temp.election_json[0].fields.site_description ?? temp.election_json[0].fields.summary;
        
        const modView = createModView(mod, imageUrl, description);
        document.getElementById("mod-grid").appendChild(modView);
        modList.push(modView);
    });

    createTagButtons(tagsFound);
    
});

function filterMods(event) {
    nameFilter = event.target.value.toLowerCase();
    updateModViews();
}

function createTagButtons(tagsFound) {
    const tagsGrid = document.getElementById("tags");
    tagsFound.forEach(function(tag) {
        const tagButton = document.createElement("div");

        tagButton.classList.add("tag-button");
        tagButton.innerHTML = `
        <input type="checkbox" id="${tag}" name="${tag}" value="${tag}" checked>
        <label style="user-select:none" for="${tag}">${tag}</label><br>
        `;
        tagsGrid.appendChild(tagButton);
        const checkbox = tagButton.getElementsByTagName("INPUT")[0];

        tagButton.addEventListener('click', function (event) {
            if(event.target == tagButton)
            checkbox.click();
        });

        tagList.push(checkbox);
        checkbox.addEventListener("change", updateModViews);
    });
}

function updateModViews(event) {
    const activeTags = new Set();
    for(let i = 0; i < tagList.length; i++) {
        if(tagList[i].checked) {
            activeTags.add(tagList[i].value);
        }
    }


    for(let i = 0; i < modList.length; i++) {
        let hasTag = false;
        const modTags = modList[i].getAttribute("tags").split(" ");
        for(let j = 0; j < modTags.length; j++) {
            const tag = modTags[j];
            const modName = modList[i].getAttribute("mod-name");
            const modDisplayName = modList[i].getAttribute("mod-display-name");
            if((nameFilter.replace(" ", "") == "" || modDisplayName.includes(nameFilter)) && activeTags.has(tag) && (!onlyFavorites || isFavorite(modName))) {
                hasTag = true;
                break;
            }
        }
        modList[i].style.display = hasTag ? "flex" : "none";
    }
}

function isFavorite(modName) {
    return favoriteMods.has(modName);
}

function setCategory(event, category) {

    const tabs = document.getElementsByClassName("tablinks");
    for(let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];

        tab.className = tab.className.replace(" active", "");
        
        if(tab == event.target) {
            event.currentTarget.className += " active";
        }
    }

    if(category == "all") {
        onlyFavorites = false;
    }
    else if(category == "favorites") {
        onlyFavorites = true;
    }

    updateModViews();
}

function createModView(mod, imageUrl, description) {
    const modView = document.createElement("div");
    modView.classList.add("community-grid-element")

    modView.setAttribute("tags", mod.dataset.tags);
    modView.setAttribute("mod-name", mod.value);
    modView.setAttribute("mod-display-name", mod.innerText.toLowerCase());

    const favText = isFavorite(mod.value) ? "Unfavorite" : "Favorite"; 

    modView.innerHTML = `
    <div class="mod-title">
        <p>${mod.innerText}</p>
    </div>
    <img class="mod-image" src="${imageUrl}"></img>
    <div class="mod-desc">${description}</div>
    <button class="hover-button" onclick="loadModFromButton(\`${mod.value}\`)"><span>Load Mod</span></button>
    <button class="hover-button" onclick="toggleFavorite(event, \`${mod.value}\`)"><span>${favText}</span></button>
    `

    return modView;
}

function toggleFavorite(event, modValue) {
    const inFavorites = isFavorite(modValue);
    if(!inFavorites) {
        favoriteMods.add(modValue);
        event.target.innerText = "Unfavorite"
    }
    else {
        favoriteMods.delete(modValue);
        event.target.innerText = "Favorite";
    }
    localStorage.setItem("favoriteMods", Array.from(favoriteMods));
    updateModViews();
}

function loadModFromButton(modValue) {
    loadingFromModButton = true;
    var client = new XMLHttpRequest();
    client.open('GET', "../static/mods/" + modValue + "_init.html");
    client.onreadystatechange = function() {
        evaluate(client.responseText)
    }
    client.send();
    diff_mod = true
    
    $("#modloaddiv")[0].style.display = 'none'
    $("#modLoadReveal")[0].style.display = 'none'
    document.getElementById("featured-mods-area").style.display = "none";
    modded = true
}

function getAllIndexes(arr, val) {
    var indexes = [], i = -1;
    while ((i = arr.indexOf(val, i+1)) != -1){
        indexes.push(i);
    }
    return indexes;
}

async function loadEntries() {
    
    const modList = await fetch("../static/mods/MODLOADERFILE.html");

    $("#modSelect").html(await modList.text());
    //clone so we don't reduce the list of mods every time a tag is selected
    originalOptions = $("#modSelect option").clone();
    filterEntries();
}

function filterEntries() {
    var selectedTags = [];

    // Get all selected tags
    $('.tagCheckbox:checked').each(function() {
        selectedTags.push($(this).val());
    });

    var filteredOptions = originalOptions.filter(function() {
        var entryTags = $(this).data('tags');

        if (selectedTags.length === 0) {
            // Show all if no tags are selected
            return true;
        }

        //return mods that are tagged and have all checked tags
        return entryTags && (containsAllTags(entryTags, selectedTags));
    });

    var $modSelect = $('#modSelect');
    $modSelect.empty().append(filteredOptions);

    $modSelect.val($modSelect.find('option:first').val());
}

function containsAllTags(entryTags, selectedTags) {
    var entryTagArray = entryTags.split(' ');

    for (var i = 0; i < selectedTags.length; i++) {
        if (!entryTagArray.includes(selectedTags[i])) {
            return false;
        }
    }

    return true;
}