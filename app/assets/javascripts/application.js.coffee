#= require jquery_ujs
#= require turbolinks
#= require bootstrap
#= require jquery.autosize
#= require jquery.validate
#= require jquery.timeago
#= require nprogress
#= require_self
#= require_tree ./plugins
#= require_tree ./simditor

window.campo = {}

ready = ->
  search_form = $('form.search-form')
  $('input', search_form)
    .focus -> search_form.addClass 'typing'
    .blur -> search_form.removeClass 'typing'
  $('b', search_form).on 'click', -> search_form.submit()

  jumbotron = $('#jumbotron')

  $('a.apptoggle').on 'click', ->
    if jumbotron.is(":visible")
      $('#matchfilter').show()
    else
      $('body')[0].scrollTop = 0
      $('#matchfilter').hide()
    jumbotron.slideToggle()
    $(this).parent('li').toggleClass('active')

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

$(document).ready ready

$(document).on 'page:fetch', ->
  NProgress.start()
.on 'page:change', ->
  NProgress.done()
.on 'page:restore', ->
  NProgress.remove()
.on 'page:update', ->
  $('[data-behaviors~=autosize]').autosize()
  $("time[data-behaviors~=timeago]").timeago()
.on 'page:load', ready

window.jiathis_config =
    siteNum: 6
    sm: "douban,twitter,tqq,renren,fb,googleplus"
    summary: ""
    shortUrl: true
    hideMore: true