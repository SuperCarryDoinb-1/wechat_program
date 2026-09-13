// 基于 AITI.md；M1 校准两处权重；M7 将 Q7-B 的夸张死亡表达改为使用不适，计分不变。
module.exports = [
  {
    "id": 1,
    "title": "深夜赶方案,AI 给了一版初稿,你会:",
    "imageIndex": 0,
    "options": [
      {
        "label": "A",
        "text": "改到亲妈都不认识才敢用",
        "score": {
          "rel": -2,
          "lead": -2
        }
      },
      {
        "label": "B",
        "text": "通读一遍,改几个词就交",
        "score": {
          "att": 1,
          "lead": 1
        }
      },
      {
        "label": "C",
        "text": "直接交,出事再说",
        "score": {
          "att": 1,
          "lead": 2
        }
      },
      {
        "label": "D",
        "text": "不用,自己写踏实",
        "score": {
          "att": -2,
          "lead": -2
        }
      }
    ]
  },
  {
    "id": 2,
    "title": "AI 的回答里出现一个你拿不准的数据,你会:",
    "imageIndex": 1,
    "options": [
      {
        "label": "A",
        "text": "顺手搜一下核实",
        "score": {
          "att": -1,
          "lead": -1
        }
      },
      {
        "label": "B",
        "text": "让它给出处,不给就不信",
        "score": {
          "att": -2,
          "lead": -1
        }
      },
      {
        "label": "C",
        "text": "它这么说应该没错",
        "score": {
          "att": 2,
          "lead": 2
        }
      },
      {
        "label": "D",
        "text": "反正没人看那么细",
        "score": {
          "lead": 2
        }
      }
    ]
  },
  {
    "id": 3,
    "title": "你平时怎么称呼你的 AI?",
    "imageIndex": 2,
    "options": [
      {
        "label": "A",
        "text": "就是个软件",
        "score": {
          "rel": -2
        }
      },
      {
        "label": "B",
        "text": "\"它\"",
        "score": {
          "rel": -1
        }
      },
      {
        "label": "C",
        "text": "我给它起了名字",
        "score": {
          "rel": 2
        }
      },
      {
        "label": "D",
        "text": "\"老师\"/\"大神\"",
        "score": {
          "rel": 1,
          "att": 1,
          "lead": 1
        }
      }
    ]
  },
  {
    "id": 4,
    "title": "朋友发来一张 AI 生成的旅行照,人像好看到不真实,你的第一反应:",
    "imageIndex": 3,
    "options": [
      {
        "label": "A",
        "text": "问用的什么模型,我也要学",
        "score": {
          "rel": -1,
          "att": 1,
          "lead": -1
        }
      },
      {
        "label": "B",
        "text": "好看是好看,但有点瘆人",
        "score": {
          "att": -1
        }
      },
      {
        "label": "C",
        "text": "帮我也来一张!",
        "score": {
          "att": 1,
          "lead": 1
        }
      },
      {
        "label": "D",
        "text": "这不叫照片,这叫作弊",
        "score": {
          "att": -2,
          "rel": 1
        }
      }
    ]
  },
  {
    "id": 5,
    "title": "如果 AI 记住了你所有的聊天记录,你会:",
    "imageIndex": 4,
    "options": [
      {
        "label": "A",
        "text": "太好了,越懂我越省事",
        "score": {
          "rel": 2,
          "att": 2
        }
      },
      {
        "label": "B",
        "text": "可以,但我要能随时删",
        "score": {
          "att": -1,
          "lead": -1
        }
      },
      {
        "label": "C",
        "text": "有点不舒服",
        "score": {
          "att": -2
        }
      },
      {
        "label": "D",
        "text": "无所谓,我也没什么秘密",
        "score": {
          "lead": 2
        }
      }
    ]
  },
  {
    "id": 6,
    "title": "心情很差的一个晚上,你会:",
    "imageIndex": 5,
    "options": [
      {
        "label": "A",
        "text": "打开 AI 聊两句",
        "score": {
          "rel": 2
        }
      },
      {
        "label": "B",
        "text": "找个真人聊",
        "score": {
          "rel": -1
        }
      },
      {
        "label": "C",
        "text": "打开 AI,但只让它干活",
        "score": {
          "rel": -2
        }
      },
      {
        "label": "D",
        "text": "忍不住聊了,聊完又觉得自己有点怪",
        "score": {
          "rel": 1,
          "att": -1,
          "lead": 1
        }
      }
    ]
  },
  {
    "id": 7,
    "title": "一整周不能用任何 AI,你会:",
    "imageIndex": 6,
    "options": [
      {
        "label": "A",
        "text": "效率减半,但活得下去",
        "score": {
          "lead": -1
        }
      },
      {
        "label": "B",
        "text": "我会非常不适应",
        "score": {
          "att": 1,
          "lead": 2
        }
      },
      {
        "label": "C",
        "text": "正好,清净",
        "score": {
          "att": -2,
          "lead": -2
        }
      },
      {
        "label": "D",
        "text": "会想它",
        "score": {
          "rel": 2
        }
      }
    ]
  },
  {
    "id": 8,
    "title": "AI 犯了个错,害你当众出丑,你会:",
    "imageIndex": 7,
    "options": [
      {
        "label": "A",
        "text": "是我提示词没写好",
        "score": {
          "rel": -1,
          "lead": -2
        }
      },
      {
        "label": "B",
        "text": "骂它一顿,然后接着用",
        "score": {
          "rel": 1,
          "att": -1,
          "lead": 1
        }
      },
      {
        "label": "C",
        "text": "果然不能信",
        "score": {
          "att": -2
        }
      },
      {
        "label": "D",
        "text": "它下次会改的",
        "score": {
          "rel": 1,
          "att": 2
        }
      }
    ]
  },
  {
    "id": 9,
    "title": "公司宣布\"全员必须用 AI\",你的内心:",
    "imageIndex": 8,
    "options": [
      {
        "label": "A",
        "text": "早就在用,终于等到这天",
        "score": {
          "att": 2,
          "lead": -1
        }
      },
      {
        "label": "B",
        "text": "行吧,该学学了",
        "score": {
          "lead": 1
        }
      },
      {
        "label": "C",
        "text": "又要学新东西,烦",
        "score": {
          "att": -1,
          "lead": 2
        }
      },
      {
        "label": "D",
        "text": "我用不用你管不着",
        "score": {
          "att": -2,
          "lead": -2
        }
      }
    ]
  },
  {
    "id": 10,
    "title": "刷到\"AI 将取代 XX 岗位\"的新闻,你会:",
    "imageIndex": 9,
    "options": [
      {
        "label": "A",
        "text": "那我得成为最会用 AI 的那个",
        "score": {
          "att": 2,
          "lead": -2
        }
      },
      {
        "label": "B",
        "text": "取代就取代,少干点活",
        "score": {
          "att": 1,
          "lead": 2
        }
      },
      {
        "label": "C",
        "text": "危言耸听,划走",
        "score": {
          "att": -1,
          "lead": -1
        }
      },
      {
        "label": "D",
        "text": "真有点怕,想学门 AI 替不了的手艺",
        "score": {
          "att": -2,
          "rel": 1
        }
      }
    ]
  },
  {
    "id": 11,
    "title": "你希望 AI 是:",
    "imageIndex": 10,
    "options": [
      {
        "label": "A",
        "text": "一把好用的刀",
        "score": {
          "rel": -2
        }
      },
      {
        "label": "B",
        "text": "一个靠谱的员工",
        "score": {
          "rel": -2,
          "lead": -1
        }
      },
      {
        "label": "C",
        "text": "一个懂我的朋友",
        "score": {
          "rel": 2
        }
      },
      {
        "label": "D",
        "text": "一个能替我做决定的人",
        "score": {
          "rel": 1,
          "lead": 2
        }
      }
    ]
  },
  {
    "id": 12,
    "title": "十年后,人和 AI 的关系会是:",
    "imageIndex": 11,
    "options": [
      {
        "label": "A",
        "text": "人驾驭 AI",
        "score": {
          "att": 1,
          "lead": -2
        }
      },
      {
        "label": "B",
        "text": "AI 照顾人",
        "score": {
          "rel": 1,
          "att": 2,
          "lead": 2
        }
      },
      {
        "label": "C",
        "text": "互相提防",
        "score": {
          "att": -2
        }
      },
      {
        "label": "D",
        "text": "分不清谁是谁",
        "score": {
          "rel": 2
        }
      }
    ]
  }
];
