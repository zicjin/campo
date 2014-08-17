#= require_self
#= require_tree ../plugins

window.campo = {}

ready = ->


$(document).ready ready

$(document).on 'page:load', ready

window.jiathis_config =
    siteNum: 6
    sm: "douban,twitter,tqq,renren,fb,googleplus"
    summary: ""
    shortUrl: true
    hideMore: true