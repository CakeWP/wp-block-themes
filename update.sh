#!/bin/bash

echo "👍 Starting the update process"

TOTAL_PAGES=$(curl -s "https://api.wordpress.org/themes/info/1.1/?action=query_themes&request%5Btag%5D=full-site-editing&request%5Bpage%5D=1" | jq '.info.pages')

echo "👍 Total $TOTAL_PAGES Pages found. Preparing for iteration"

for PAGE in $(seq 1 $TOTAL_PAGES)
do
    echo "👍 Updating themes in page: $PAGE"

    THEMES_IN_CURRENT_PAGE=$(curl -s "https://api.wordpress.org/themes/info/1.1/?action=query_themes&request%5Btag%5D=full-site-editing&request%5Bpage%5D=$PAGE" | jq '.themes')

    for row in $(echo "${THEMES_IN_CURRENT_PAGE}" | jq -r '.[] | @base64'); do
        _jq() {
            echo ${row} | base64 --decode | jq -r ${1}
        }
        
        THEME_SLUG=$(_jq '.slug')
        THEME_VERSION=$(_jq '.version')
        THEME_NAME=$(_jq '.name')

        echo "😎 Downloading theme.json for theme: $THEME_NAME"

        # Deleting the pre-existing directory    
        rm -rf "./themes/$THEME_SLUG"

        # Creating directory for the theme.json.
        mkdir "./themes/$THEME_SLUG"

        # Saving additional information about the theme.
        touch "./themes/$THEME_SLUG/details.json"

        # Storing info
        echo ${row} | base64 --decode > "./themes/$THEME_SLUG/details.json"

        wget "https://themes.svn.wordpress.org/$THEME_SLUG/$THEME_VERSION/theme.json" -P "./themes/$THEME_SLUG"
        wget "https://wp-themes.com/$THEME_SLUG/" -P "./themes/$THEME_SLUG"
    done
done

echo "🎉 Update Process Completed!"