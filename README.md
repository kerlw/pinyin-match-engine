# 拼音匹配引擎
------

感谢https://github.com/aui/pinyin-engine

原拼音引擎存在以下问题：

1. 不能够给出匹配的汉字的位置和长度
2. 全拼匹配的时候可能会从拼音的韵母部分开始匹配，比如‘axue’可以匹配到‘大学’的拼音

为了解决这些问题，我只好借鉴前人成果做了一版修改

## 匹配的思路

思路比较简单：

* 优先进行首字母缩写匹配，如果首字母缩写不能够匹配，且关键词长度大于1，那么则进行全拼匹配
* 全拼匹配使用首字母缩写和关键词的第一个字母来优化搜索路径
* 判断全拼的拼音和关键词的匹配关系时，用递归实现

匹配的结果给出匹配的位置、长度、字段key，这样可以更利于结果的显示处理


## 安装

```shell
npm install pinyin-match-engine --save
```

## API

构造和query的用法基本保持原版语法，新增了一个strictMatch函数来实现严格匹配并返回匹配的位置和长度

### new PinyinEngine(list, keys)

建立拼音索引。

参数：

1. list `{[string]|[Object]}` 被索引的目标
2. keys `{[string]}` 可选。如果 list 为 `Object`，这里用来设置需要被索引的 key
3. begin `{[boolean]}` 可选。如果 begin 为 `true`，将执行前模糊检索 (目前仅对query有效)

### .query(keyword)

查询匹配拼音的数据。

参数：

1. keyword `{string}` 拼音或者关键字

返回：

`{[string]|{Object}}`

### .strictMatch(keyword)

查询严格匹配拼音的数据，所谓严格匹配是指不能把起始汉字的拼音拆开后从后半部分开始匹配。但是允许把匹配的最后一个汉字的拼音拆分后仅匹配前面部分，如果有需求只允许完全匹配拼音，可以在engine.js中做一处修改来实现，暂时没有提供构造时的选项，有此类需求请在issue中留言

参数：同.query

返回：

`[{...data, matchPos: integer, matchLen: integer},...]`

## 使用范例

列表项为字符串：

```js
import PinyinEngine from 'pinyin-match-engine';

// 建立数据索引
const pinyinEngine = new PinyinEngine([
    '清华大学',
    '北京大学',
    '中央美院'
]);

// 查询
pinyinEngine.query('daxue'); // ['清华大学', '北京大学']
// 进阶查询，需要匹配位置和长度的
pinyinEngine.strictMatch('daxue');
```

列表项为对象：

```js
import PinyinEngine from 'pinyin-match-engine';

// 建立数据索引
const pinyinEngine = new PinyinEngine([
    { id: 0, name: '清华大学' },
    { id: 1, name: '北京大学' },
    { id: 3, name: '中央美院' }
], ['name']);

// 查询
pinyinEngine.query('daxue'); // ['清华大学', '北京大学']
// 进阶查询，需要匹配位置和长度的
pinyinEngine.strictMatch('daxue');
```

