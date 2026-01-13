<p align="center"><img src="https://chielreijnen.nl/cardmadness/card-title.png" width="400" alt="Logo"></p>

# Making card packs 


## Card text variables

Make your game even more fun with our variables. Every variable is compatible with black and white cards and can be used multiple times. 


### :answer
> [!NOTE]
> White cards with ``:answer`` are seen as blank cards by the server. Players can fill them in themself. Lobby settings can prevent blank cards in a game.

The ``:answer`` variable is a multi purpose variable of a black card or a white blank card. Although **black cards require a ``:answer``** white cards do not. Multiple answers are allowed in a black card. In a white card all the answers gets replaced with the first answer that is given by the player.




**Examples:**
```JSON
{
    "black": [
        ":answer, way better if its just gone."
        ":answer, way better with :answer"
        
    ],
    "white": [
        ":answer",
        "A random person his :answer",
    ]
}

```
### :name

The ``:name`` variable is a powerfull way of giving a personal boost to your card. If a card uses ``:name`` the variable gets replaced with a random player name from that lobby. The selection is for every variable present in the card random and permanent for the card in the players hand, even if the player the name is copied from already left. 


**Examples:**
```JSON
{
    "black": [
        "Why did :name's cat run away? :answer"
        ":name and :name a powerfull couple with :answer"
    ],
    "white": [
        ":name's agressive way of saying no to someone",
    ]
}
```




## You want your pack in the base game?
We want it to! Contribute to our base game by making a pull request with your awesome pack. Base packs are nothing more then preconfigured packs for everyone. If your pack follows the guidelines listed below, we will make sure that your pack is playable for everyone!

**Base pack guidelines**

1. Black and white cards are **~90%** compatible with any other base game pack.

2. Offensive or NSFW packs should **always** have the NSFW tag set to ``true``.

3. Your pack has a minimum of **20 black cards** and **30 white cards**. 

4. Your pack should be playable by anyone, no inside jokes.

4. Offensive packs should not explicitly target groups or minorities*
> *: Offensive packs are fun because offensive combinations CAN exists, they dont have to. We are not promoting hatred towards groups of people. Any type of pack containing forced combinations with hatred will be denied instantly. We do understand that this rule is vague. The fist rule is: if you made the pack to target any group of people in a hatefull way without giving space for other combinations, its not getting accepted and we highly recommend you to try a different play style in this game. 

