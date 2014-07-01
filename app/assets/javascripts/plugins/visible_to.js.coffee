campo.VisibleTo =
  # data-visible-to="options"
  #
  # options:
  #   - user: Visible to logined user
  #     Check if campo.currentUserId exists.
  #
  #   - creator: Visible to creator
  #     Find closest element witch has data-creator-id,
  #     and compare with campo.currentUserId.
  #
  #   - no-creator: Visible to anyone except creator
  check: ->
    $('[data-visible-to]').each ->
      $element = $(this)
      rules = $element.data('visible-to').split(/\s/)

      if 'user' in rules
        if !campo.currentUserId?
          return $element.remove()

      if 'creator' in rules
        creator_id = $element.closest('[data-creator-id]').data('creator-id')
        if (!campo.currentUserId?) or (campo.currentUserId != creator_id)
          return $element.remove()

      if 'no-creator' in rules
        creator_id = $element.closest('[data-creator-id]').data('creator-id')
        if campo.currentUserId? and (campo.currentUserId == creator_id)
          return $element.remove()

$(document).on 'page:update', ->
  campo.VisibleTo.check()
