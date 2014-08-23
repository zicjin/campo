#= require_self
#= require_tree ../plugins

ready = ->

$(document).ready ready

$(document).on 'page:load', ready

window.console = new Object()
window.console.log = (log)->
    iframe = document.createElement("IFRAME")
    iframe.setAttribute "src", "ios-log:#iOS#" + log
    document.documentElement.appendChild iframe
    iframe.parentNode.removeChild iframe
    iframe = null
window.console.debug = console.log
window.console.info = console.log
window.console.warn = console.log
window.console.error = console.log