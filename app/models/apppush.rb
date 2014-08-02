class Apppush
  include Mongoid::Document
  field :content
  field :appid
  field :time, type: DateTime
  field :pushed, type: Boolean
end