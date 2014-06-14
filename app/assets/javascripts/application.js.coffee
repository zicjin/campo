#= require jquery
#= require jquery_ujs
#= require turbolinks
#= require bootstrap
#= require jquery.autosize
#= require jquery.validate
#= require jquery.timeago
#= require nprogress
#= require campo
#= require_tree ./plugins

$(document).on 'page:fetch', ->
  NProgress.start()
$(document).on 'page:change', ->
  NProgress.done()
$(document).on 'page:restore', ->
  NProgress.remove()

$(document).on 'page:update', ->
  $('[data-behaviors~=autosize]').autosize()

  $("time[data-behaviors~=timeago]").timeago()
  search_form = $('form.search-form')
  $('input', search_form)
    .focus -> search_form.addClass 'typing'
    .blur -> search_form.removeClass 'typing'
  $('b', search_form).on 'click', -> search_form.submit()