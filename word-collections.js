/*
  Optional starter vocabulary. These entries remain separate from a learner's
  vocabulary until they explicitly add them to Lessons.

  JLPT is intentionally Unknown: the JLPT does not publish a definitive word
  list, and TobuKaba does not present third-party estimates as official data.
*/
globalThis.TOBUKABA_WORD_COLLECTIONS = Object.freeze([
  {
    id: "useful-everyday-verbs",
    name: "Useful everyday verbs",
    description: "Twenty practical actions for reading, writing, travel, and daily conversation.",
    words: [
      { id:"verb-iku", english:"to go", kanji:"行く", hiragana:"いく", pos:"Verb" },
      { id:"verb-kuru", english:"to come", kanji:"来る", hiragana:"くる", pos:"Verb" },
      { id:"verb-miru", english:"to see/watch", kanji:"見る", hiragana:"みる", pos:"Verb" },
      { id:"verb-kiku", english:"to hear/listen/ask", kanji:"聞く", hiragana:"きく", pos:"Verb" },
      { id:"verb-hanasu", english:"to speak", kanji:"話す", hiragana:"はなす", pos:"Verb" },
      { id:"verb-yomu", english:"to read", kanji:"読む", hiragana:"よむ", pos:"Verb" },
      { id:"verb-kaku", english:"to write", kanji:"書く", hiragana:"かく", pos:"Verb" },
      { id:"verb-taberu", english:"to eat", kanji:"食べる", hiragana:"たべる", pos:"Verb" },
      { id:"verb-nomu", english:"to drink", kanji:"飲む", hiragana:"のむ", pos:"Verb" },
      { id:"verb-kau", english:"to buy", kanji:"買う", hiragana:"かう", pos:"Verb" },
      { id:"verb-tsukau", english:"to use", kanji:"使う", hiragana:"つかう", pos:"Verb" },
      { id:"verb-tsukuru", english:"to make", kanji:"作る", hiragana:"つくる", pos:"Verb" },
      { id:"verb-matsu", english:"to wait", kanji:"待つ", hiragana:"まつ", pos:"Verb" },
      { id:"verb-kaeru", english:"to return/go home", kanji:"帰る", hiragana:"かえる", pos:"Verb" },
      { id:"verb-hairu", english:"to enter", kanji:"入る", hiragana:"はいる", pos:"Verb" },
      { id:"verb-deru", english:"to leave/come out", kanji:"出る", hiragana:"でる", pos:"Verb" },
      { id:"verb-okiru", english:"to wake up", kanji:"起きる", hiragana:"おきる", pos:"Verb" },
      { id:"verb-neru", english:"to sleep", kanji:"寝る", hiragana:"ねる", pos:"Verb" },
      { id:"verb-wakaru", english:"to understand", kanji:"分かる", hiragana:"わかる", pos:"Verb" },
      { id:"verb-omou", english:"to think", kanji:"思う", hiragana:"おもう", pos:"Verb" }
    ]
  },
  {
    id: "everyday-life",
    name: "Everyday life",
    description: "Familiar people, places, and things that appear often in ordinary Japanese.",
    words: [
      { id:"life-hito", english:"person", kanji:"人", hiragana:"ひと", pos:"Noun" },
      { id:"life-namae", english:"name", kanji:"名前", hiragana:"なまえ", pos:"Noun" },
      { id:"life-kyou", english:"today", kanji:"今日", hiragana:"きょう", pos:"Noun" },
      { id:"life-ashita", english:"tomorrow", kanji:"明日", hiragana:"あした", pos:"Noun" },
      { id:"life-asa", english:"morning", kanji:"朝", hiragana:"あさ", pos:"Noun" },
      { id:"life-yoru", english:"night", kanji:"夜", hiragana:"よる", pos:"Noun" },
      { id:"life-jikan", english:"time", kanji:"時間", hiragana:"じかん", pos:"Noun" },
      { id:"life-ie", english:"house/home", kanji:"家", hiragana:"いえ", pos:"Noun" },
      { id:"life-gakkou", english:"school", kanji:"学校", hiragana:"がっこう", pos:"Noun" },
      { id:"life-shigoto", english:"work/job", kanji:"仕事", hiragana:"しごと", pos:"Noun" },
      { id:"life-mise", english:"shop/store", kanji:"店", hiragana:"みせ", pos:"Noun" },
      { id:"life-eki", english:"station", kanji:"駅", hiragana:"えき", pos:"Noun" },
      { id:"life-densha", english:"train", kanji:"電車", hiragana:"でんしゃ", pos:"Noun" },
      { id:"life-kuruma", english:"car", kanji:"車", hiragana:"くるま", pos:"Noun" },
      { id:"life-okane", english:"money", kanji:"お金", hiragana:"おかね", pos:"Noun" },
      { id:"life-mizu", english:"water", kanji:"水", hiragana:"みず", pos:"Noun" },
      { id:"life-shokuji", english:"meal", kanji:"食事", hiragana:"しょくじ", pos:"Noun" },
      { id:"life-tomodachi", english:"friend", kanji:"友達", hiragana:"ともだち", pos:"Noun" },
      { id:"life-kazoku", english:"family", kanji:"家族", hiragana:"かぞく", pos:"Noun" },
      { id:"life-tenki", english:"weather", kanji:"天気", hiragana:"てんき", pos:"Noun" }
    ]
  },
  {
    id: "useful-opposites-and-descriptions",
    name: "Useful opposites and descriptions",
    description: "Ten memorable adjective pairs for describing everyday people, places, and things.",
    words: [
      { id:"description-ookii", english:"big", kanji:"大きい", hiragana:"おおきい", pos:"い-adjective" },
      { id:"description-chiisai", english:"small", kanji:"小さい", hiragana:"ちいさい", pos:"い-adjective" },
      { id:"description-atarashii", english:"new", kanji:"新しい", hiragana:"あたらしい", pos:"い-adjective" },
      { id:"description-furui", english:"old", kanji:"古い", hiragana:"ふるい", pos:"い-adjective" },
      { id:"description-takai", english:"expensive/high", kanji:"高い", hiragana:"たかい", pos:"い-adjective" },
      { id:"description-yasui", english:"inexpensive", kanji:"安い", hiragana:"やすい", pos:"い-adjective" },
      { id:"description-nagai", english:"long", kanji:"長い", hiragana:"ながい", pos:"い-adjective" },
      { id:"description-mijikai", english:"short", kanji:"短い", hiragana:"みじかい", pos:"い-adjective" },
      { id:"description-hayai", english:"early/fast", kanji:"早い", hiragana:"はやい", pos:"い-adjective" },
      { id:"description-osoi", english:"late/slow", kanji:"遅い", hiragana:"おそい", pos:"い-adjective" },
      { id:"description-ooi", english:"many", kanji:"多い", hiragana:"おおい", pos:"い-adjective" },
      { id:"description-sukunai", english:"few", kanji:"少ない", hiragana:"すくない", pos:"い-adjective" },
      { id:"description-chikai", english:"near", kanji:"近い", hiragana:"ちかい", pos:"い-adjective" },
      { id:"description-tooi", english:"far", kanji:"遠い", hiragana:"とおい", pos:"い-adjective" },
      { id:"description-tsuyoi", english:"strong", kanji:"強い", hiragana:"つよい", pos:"い-adjective" },
      { id:"description-yowai", english:"weak", kanji:"弱い", hiragana:"よわい", pos:"い-adjective" },
      { id:"description-akarui", english:"bright", kanji:"明るい", hiragana:"あかるい", pos:"い-adjective" },
      { id:"description-kurai", english:"dark", kanji:"暗い", hiragana:"くらい", pos:"い-adjective" },
      { id:"description-atsui", english:"hot", kanji:"暑い", hiragana:"あつい", pos:"い-adjective" },
      { id:"description-samui", english:"cold", kanji:"寒い", hiragana:"さむい", pos:"い-adjective" }
    ]
  },
  {
    id: "food-and-shopping",
    name: "Food and shopping",
    description: "Practical words for meals, ingredients, prices, and everyday shopping.",
    words: [
      { id:"shopping-kaimono", english:"shopping", kanji:"買い物", hiragana:"かいもの", pos:"Noun" },
      { id:"shopping-shouhin", english:"product", kanji:"商品", hiragana:"しょうひん", pos:"Noun" },
      { id:"shopping-nedan", english:"price", kanji:"値段", hiragana:"ねだん", pos:"Noun" },
      { id:"shopping-tenin", english:"shop assistant", kanji:"店員", hiragana:"てんいん", pos:"Noun" },
      { id:"shopping-chuumon", english:"order", kanji:"注文", hiragana:"ちゅうもん", pos:"Noun" },
      { id:"shopping-kaikei", english:"bill/checkout", kanji:"会計", hiragana:"かいけい", pos:"Noun" },
      { id:"shopping-en", english:"yen", kanji:"円", hiragana:"えん", pos:"Noun" },
      { id:"food-ryouri", english:"cooking/cuisine", kanji:"料理", hiragana:"りょうり", pos:"Noun" },
      { id:"food-tabemono", english:"food", kanji:"食べ物", hiragana:"たべもの", pos:"Noun" },
      { id:"food-nomimono", english:"drink", kanji:"飲み物", hiragana:"のみもの", pos:"Noun" },
      { id:"food-yasai", english:"vegetables", kanji:"野菜", hiragana:"やさい", pos:"Noun" },
      { id:"food-kudamono", english:"fruit", kanji:"果物", hiragana:"くだもの", pos:"Noun" },
      { id:"food-niku", english:"meat", kanji:"肉", hiragana:"にく", pos:"Noun" },
      { id:"food-sakana", english:"fish", kanji:"魚", hiragana:"さかな", pos:"Noun" },
      { id:"food-kome", english:"rice", kanji:"米", hiragana:"こめ", pos:"Noun" },
      { id:"food-gyuunyuu", english:"milk", kanji:"牛乳", hiragana:"ぎゅうにゅう", pos:"Noun" },
      { id:"food-choushoku", english:"breakfast", kanji:"朝食", hiragana:"ちょうしょく", pos:"Noun" },
      { id:"food-chuushoku", english:"lunch", kanji:"昼食", hiragana:"ちゅうしょく", pos:"Noun" },
      { id:"food-yuushoku", english:"dinner", kanji:"夕食", hiragana:"ゆうしょく", pos:"Noun" },
      { id:"food-ocha", english:"tea", kanji:"お茶", hiragana:"おちゃ", pos:"Noun" }
    ]
  }
].map(collection => Object.freeze({
  ...collection,
  words: Object.freeze(collection.words.map(word => Object.freeze({
    ...word,
    collectionId: collection.id,
    category: "No Category",
    jlpt: "Unknown"
  })))
})));
