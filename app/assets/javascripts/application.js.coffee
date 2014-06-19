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

  $('a.apptoggle').on 'click', ->
    $('#jumbotron').slideToggle()
    $(this).parent('li').toggleClass('active')

  jumbotron = $('#jumbotron')
  $('.androidbtn', jumbotron).hover ->
    if not glo_touchDevice
      $('.androidpic').show()
      $('.iphonepic').hide()
  , null
  $('.iphonebtn', jumbotron).hover ->
    if not glo_touchDevice
      $('.androidpic').hide()
      $('.iphonepic').show()
  , null
  $('.qrwapper, .qrwapper>.close', jumbotron).on 'click', ->
    $('.qrcode', jumbotron).fadeToggle()

window.glo_iosapp_nav = ->
  $('button.navbar-toggle').click()