#= require jquery_ujs
#= require turbolinks
#= require bootstrap
#= require jquery.autosize
#= require jquery.validate
#= require jquery.timeago
#= require nprogress
#= require_self
#= require_tree ../simditor-1.0.5

window.campo = {}

$(document).on 'page:fetch', ->
  NProgress.start()
.on 'page:change', ->
  NProgress.done()
.on 'page:restore', ->
  NProgress.remove()
.on 'page:update', ->
  $('[data-behaviors~=autosize]').autosize()
  $("time[data-behaviors~=timeago]").timeago()