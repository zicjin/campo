$(document).on 'click', '.comment [data-reply-to]', ->
  glo_editor.focus()
  reply_to = $(this).data('reply-to').split(' ')
  comment_url = window.location.href.split('#')[0].replace(window.location.origin, '') + reply_to[1].replace('#','#comment-')
  glo_editor.body.prepend $("<p><a href='/#{reply_to[0].replace('@','~')}'>#{reply_to[0]}</a> <a href='#{comment_url}'>#{reply_to[1]}</a></p>")
  glo_editor.placeholderEl.hide()